# main.py

from fastapi import FastAPI, HTTPException, Request, File, Form, UploadFile, Depends
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional

import uvicorn
import uuid
import os
import json
from datetime import datetime

from src.integration.llm_client import LLMClient
from src.integration.auth import get_current_user
from src.services.rag import RAGEngine
from src.services.file_parser import FileParser
from src.services.storage import StorageManager
from src.services.report_generator import ReportGenerator
from src.services.chart_generator import ChartGenerator
from src.core.logger import get_logger, request_id_var
from src.core.exceptions import LLMConnectionError, DataProcessingError, ExportError

logger = get_logger("FastAPI")

app = FastAPI(
    title="QA Go/No-Go Decision Engine API",
    version="2.1.0",
    description="Microservice for generating and exporting automated QA deployment reports."
)


@app.middleware("http")
async def log_all_requests(request: Request, call_next):
    correlation_id = str(uuid.uuid4())[:8]
    request_id_var.set(correlation_id)
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Completed request: {response.status_code} {request.url.path}")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    llm = LLMClient()
    rag = RAGEngine(llm)
    file_parser = FileParser()
    storage = StorageManager()
    report_generator = ReportGenerator(llm)
    chart_generator = ChartGenerator()
    logger.info("All services initialized successfully")
except Exception as e:
    logger.critical(f"Service initialization failed: {e}")
    raise SystemExit(1)


class ExportRequest(BaseModel):
    project_name: str
    edited_text: str
    format: str
    language: str
    author: str
    chart_paths: List[str]
    
class ApproveReportRequest(BaseModel):
    """Request to save an approved report to history."""
    project_name: str
    report_data: dict
    language: str


class StructuredRule(BaseModel):
    """Single decision rule definition."""
    id: str
    name_pl: Optional[str] = ""
    name_en: Optional[str] = ""
    field: str
    operator: str
    threshold: float
    unit: str
    severity: str
    description_pl: Optional[str] = ""
    description_en: Optional[str] = ""


class UpdateRulesRequest(BaseModel):
    """Request to update structured decision rules."""
    rules: List[StructuredRule]
    language: str



MAX_FILE_SIZE = 5 * 1024 * 1024


@app.post("/api/v2/reports/draft")
async def generate_draft(
    project_name: str = Form(...),
    user_risks: str = Form(...),
    language: str = Form(...),
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user)
):
    try:
        contents = {}
        for file in files:
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"File {file.filename} exceeds the 5MB limit"
                )

            # validating file extension
            allowed_extensions = {'.csv', '.xls', '.xlsx'}
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {file.filename}. Allowed: CSV, XLS, XLSX"
                )

            contents[file.filename] = content


        parsed_test_data = file_parser.extract_test_data_from_bytes(contents)
        rag_context = rag.get_historical_context(lang=language)
        historical_cache = storage.get_latest_history(project_name=project_name)

        # Generate charts from uploaded data
        chart_paths = chart_generator.generate_all_charts(
            file_contents=contents,
            project_name=project_name,
            lang=language
        )

        draft_json = report_generator.generate_structured_draft(
            historical_cache=historical_cache,
            rag_context=rag_context,
            parsed_test_data=parsed_test_data,
            user_risks=user_risks,
            project_name=project_name,
            lang=language
        )

        storage.save_to_cache(project_name=project_name, structured_data=draft_json)

        return {"draft": draft_json, "charts": chart_paths}

    except LLMConnectionError as e:
        logger.error(f"LLM connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {e}")
    except DataProcessingError as e:
        logger.error(f"Data processing error: {e}")
        raise HTTPException(status_code=422, detail=f"Data processing error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during draft generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/v2/reports/export")
def export_report(req: ExportRequest, user: dict = Depends(get_current_user)):
    try:
        fmt = req.format.lower()

        if fmt == "pdf":
            filepath = report_generator.export_to_pdf(
                final_text=req.edited_text,
                charts_paths=req.chart_paths,
                custom_name=req.project_name,
                author=req.author,
                lang=req.language
            )
        elif fmt == "docx":
            filepath = report_generator.export_to_docx(
                final_text=req.edited_text,
                charts_paths=req.chart_paths,
                custom_name=req.project_name,
                author=req.author,
                lang=req.language
            )
        elif fmt == "md":
            filepath = report_generator.export_to_md(
                final_text=req.edited_text,
                charts_paths=req.chart_paths,
                custom_name=req.project_name,
                author=req.author,
                lang=req.language
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported format. Use 'pdf', 'docx', or 'md'."
            )

        return {"status": "success", "filepath": filepath}

    except ExportError as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/api/v2/cache/{project_name}")
def delete_project_cache(project_name: str, user: dict = Depends(get_current_user)):
    try:
        success = storage.clear_cache(project_name)
        if success:
            return {
                "status": "success",
                "message": f"Cache for project '{project_name}' deleted successfully"
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No cache found for project '{project_name}'"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error while deleting cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/v2/history/approve")
def approve_report_to_history(
    req: ApproveReportRequest,
    user: dict = Depends(get_current_user)
):
    """
    Saves an approved report to the history directory so it becomes
    part of the RAG context for future analyses. This is how the
    knowledge base grows over time.
    """
    try:
        filepath = rag.save_approved_report(
            project_name=req.project_name,
            report_data=req.report_data,
            lang=req.language
        )
        return {
            "status": "success",
            "message": f"Report saved to history",
            "filepath": filepath
        }
    except DataProcessingError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to approve report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v2/history/rules/{language}")
def get_structured_rules(language: str, user: dict = Depends(get_current_user)):
    """Returns the current structured decision rules."""
    try:
        rules_text = rag.load_structured_rules(lang=language)
        rules_path = os.path.join(
            Config.HISTORY_PATH, language, "structured_rules.json"
        )

        if os.path.exists(rules_path):
            with open(rules_path, "r", encoding="utf-8") as f:
                rules_data = json.load(f)
            return {"status": "success", "data": rules_data}
        else:
            return {"status": "success", "data": {"rules": []}}

    except Exception as e:
        logger.error(f"Failed to load rules: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.put("/api/v2/history/rules")
def update_structured_rules(
    req: UpdateRulesRequest,
    user: dict = Depends(get_current_user)
):
    """Updates the structured decision rules."""
    try:
        rules_dicts = [rule.model_dump() for rule in req.rules]
        filepath = rag.update_structured_rules(
            rules=rules_dicts,
            lang=req.language,
            author=user.get("username", "unknown")
        )
        return {
            "status": "success",
            "message": "Rules updated",
            "filepath": filepath
        }
    except DataProcessingError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update rules: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v2/history/reports/{language}")
def list_history_reports(language: str, user: dict = Depends(get_current_user)):
    """Lists all history report files for a given language."""
    try:
        dir_path = os.path.join(Config.HISTORY_PATH, language)
        if not os.path.exists(dir_path):
            return {"status": "success", "reports": []}

        reports = []
        for filename in sorted(os.listdir(dir_path)):
            if filename.endswith(".txt"):
                filepath = os.path.join(dir_path, filename)
                stat = os.stat(filepath)
                reports.append({
                    "filename": filename,
                    "size_kb": round(stat.st_size / 1024, 1),
                    "modified": datetime.fromtimestamp(
                        stat.st_mtime
                    ).strftime("%Y-%m-%d %H:%M:%S"),
                })

        return {"status": "success", "reports": reports}

    except Exception as e:
        logger.error(f"Failed to list history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
        

current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dist_path = os.path.join(current_dir, "..", "frontend", "dist")

if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")
    logger.info(f"Frontend mounted from: {frontend_dist_path}")
else:
    logger.warning(f"Frontend dist folder not found: {frontend_dist_path}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)