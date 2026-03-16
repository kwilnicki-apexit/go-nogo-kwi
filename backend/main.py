# ============================================================
# FILE: .\backend\main.py
# ============================================================

from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Depends
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List

import uvicorn
import uuid
import os

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
    description="Microservice for generating and exporting automated QA deployment reports.",
)


@app.middleware("http")
async def log_all_requests(request: Request, call_next):
    """Assigns a correlation ID to each request and logs entry/exit."""
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

# Service initialization
try:
    llm = LLMClient()
    rag = RAGEngine()
    file_parser = FileParser()
    storage = StorageManager()
    report_generator = ReportGenerator(llm)
    chart_generator = ChartGenerator()
    logger.info("All services initialized successfully")
except Exception as e:
    logger.critical(f"Service initialization failed: {e}")
    raise SystemExit(1)

# ==========================================
# DATA MODELLING
# ==========================================


class ExportRequest(BaseModel):
    project_name: str
    edited_text: str
    format: str
    language: str
    author: str
    chart_paths: List[str]


MAX_FILE_SIZE = 5 * 1024 * 1024

# ==========================================
# PROJECT ENDPOINTS (p-xxxxx)
# ==========================================


@app.post("/api/v2/projects/{project_id}/instructions")
async def update_project_instructions(
    project_id: str, request: Request, user: dict = Depends(get_current_user)
):
    """Saves global instructions/assumptions for a project."""
    try:
        data = await request.json()
        instructions = data.get("instructions", "")
        storage.save_project_instructions(project_id, instructions)
        return {
            "status": "success",
            "message": "Project instructions saved successfully.",
        }
    except Exception as e:
        logger.error(f"Failed to save project instructions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/v2/projects/{project_id}/upload")
async def upload_project_files(
    project_id: str,
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    """Uploads knowledge files (PDF, DOCX) to a project and indexes them in the ChromaDB vector store."""
    try:
        proj_uploads_dir = storage.get_project_uploads_dir(project_id)
        ingested_count = 0

        for file in files:
            content = await file.read()
            file_path = os.path.join(proj_uploads_dir, file.filename)
            with open(file_path, "wb") as f:
                f.write(content)

            # Extract text from PDF/DOCX/TXT via FileParser and ingest into RAG
            text_content = file_parser.extract_history_text(file_path)
            if text_content:
                rag.ingest_document(text_content, file.filename, entity_id=project_id)
                ingested_count += 1

        return {
            "status": "success",
            "message": f"Uploaded and vectorized {ingested_count} project knowledge file(s).",
        }
    except Exception as e:
        logger.error(f"Failed to upload project files: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ==========================================
# MAIN CHAT ENDPOINT (c-xxxxx)
# ==========================================
@app.post("/api/v2/chat")
async def chat_endpoint(request: Request, user: dict = Depends(get_current_user)):
    try:
        content_type = request.headers.get("content-type", "")

        # Payload handling for both JSON and multipart/form-data (for file uploads)
        if "multipart/form-data" in content_type:
            form = await request.form()
            message = form.get("message", "")
            mode = form.get("mode", "chatbot")
            language = form.get("language", "pl")
            chat_id = form.get("chat_id")
            project_id = form.get("project_id")
            files = form.getlist("files")
        else:
            data = await request.json()
            message = data.get("message", "")
            mode = data.get("mode", "chatbot")
            language = data.get("language", "pl")
            chat_id = data.get("chat_id")
            project_id = data.get("project_id")
            files = []

        if project_id in ["", "null", "undefined", "default"]:
            project_id = None

        if not chat_id:
            raise HTTPException(
                status_code=400, detail="No chat_id provided in the request"
            )

        chat_created_dir = storage.get_chat_created_dir(chat_id)
        chart_generator.output_dir = chat_created_dir
        report_generator.final_output_path = chat_created_dir

        # -------------------
        # MODE: GO/NO-GO
        # -------------------
        if mode == "gonogo":
            chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
            contents = {}

            # REEVALUATION
            if not files:
                if os.path.exists(chat_uploads_dir):
                    for filename in os.listdir(chat_uploads_dir):
                        ext = os.path.splitext(filename)[1].lower()
                        if ext in {".csv", ".xls", ".xlsx"}:
                            file_path = os.path.join(chat_uploads_dir, filename)
                            with open(file_path, "rb") as f:
                                contents[filename] = f.read()

                if not contents:
                    msg = (
                        "Aby wygenerować raport Go/No-Go, proszę załącz pliki z wynikami testów (CSV/XLS)."
                        if language == "pl"
                        else "Please attach files with test results."
                    )
                    return {"message": msg}

                logger.info(
                    f"Re-evaluating based on {len(contents)} existing files in chat {chat_id}."
                )

            # STANDARD UPLOAD
            else:
                for file in files:
                    content = await file.read()
                    if len(content) > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Plik {file.filename} jest za duży.",
                        )

                    ext = os.path.splitext(file.filename)[1].lower()
                    if ext not in {".csv", ".xls", ".xlsx"}:
                        continue

                    file_path = os.path.join(chat_uploads_dir, file.filename)
                    with open(file_path, "wb") as f:
                        f.write(content)

                    contents[file.filename] = content

                    try:
                        text_content = file_parser.extract_test_data_from_bytes(
                            {file.filename: content}
                        )
                        rag.ingest_document(
                            text_content, file.filename, entity_id=chat_id
                        )
                    except Exception as e:
                        logger.warning(f"Could not vectorize {file.filename}: {e}")

            if not contents:
                return {
                    "message": "Nie załączono żadnych prawidłowych plików tabelarycznych."
                }

            parsed_test_data = file_parser.extract_test_data_from_bytes(contents)

            # global data - project instructions + RAG context
            project_instructions = ""
            if project_id:
                project_instructions = storage.load_project_instructions(project_id)

            # RAG
            rag_context = rag.search_context(
                query=message, project_id=project_id, chat_id=chat_id
            )

            if project_instructions:
                rag_context = f"[GLOBALNE WYTYCZNE PROJEKTU]\n{project_instructions}\n\n[DOKUMENTY RAG]\n{rag_context}"

            historical_cache = storage.get_latest_history(chat_id=chat_id)

            chart_paths = chart_generator.generate_all_charts(
                file_contents=contents, project_name=chat_id, lang=language
            )

            user_risks = message if message else "Brak dodatkowych uwag."

            draft_json = report_generator.generate_structured_draft(
                historical_cache=historical_cache,
                rag_context=rag_context,
                parsed_test_data=parsed_test_data,
                user_risks=user_risks,
                project_name=chat_id,
                lang=language,
            )

            storage.save_to_cache(chat_id=chat_id, structured_data=draft_json)

            msg_response = (
                ("Zaktualizowałem raport uwzględniając Twoje nowe wytyczne.")
                if language == "pl"
                else "Report updated with your instructions."
            )

            return {
                "message": msg_response,
                "draft_data": draft_json,
                "chart_paths": chart_paths,
            }

        # ---------------------------------------------------------
        # MODE 2: CHATBOT
        # ---------------------------------------------------------
        elif mode == "chatbot":
            sys_prompt = "You are a helpful QA (Quality Assurance) assistant and software engineer."
            reply = llm.generate_response(sys_prompt, message, temperature=0.3)
            return {"message": reply}

        # ---------------------------------------------------------
        # MODE 3 & 4: TRANSLATOR / ANALYSIS (placeholders)
        # ---------------------------------------------------------
        elif mode == "translator":
            return {"message": f"Translator module. Your message: {message}"}

        elif mode == "analysis":
            return {"message": f"Analysis module. Files received: {len(files)}"}

        else:
            return {"message": "Unknown mode of operation."}

    except LLMConnectionError as e:
        logger.error(f"LLM connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {e}")
    except DataProcessingError as e:
        logger.error(f"Data processing error: {e}")
        raise HTTPException(status_code=422, detail=f"Data processing error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during chat processing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ==========================================
# EXPORT ENDPOINT & CACHE
# ==========================================
@app.post("/api/v2/reports/export")
def export_report(req: ExportRequest, user: dict = Depends(get_current_user)):
    try:
        fmt = req.format.lower()

        # Set output folder to chat-specific directory
        chat_created_dir = storage.get_chat_created_dir(req.project_name)
        report_generator.final_output_path = chat_created_dir

        if fmt == "pdf":
            filepath = report_generator.export_to_pdf(
                final_text=req.edited_text,
                charts_paths=req.chart_paths,
                custom_name=req.project_name,
                author=req.author,
                lang=req.language,
            )
        elif fmt == "docx":
            filepath = report_generator.export_to_docx(
                final_text=req.edited_text,
                charts_paths=req.chart_paths,
                custom_name=req.project_name,
                author=req.author,
                lang=req.language,
            )
        elif fmt == "md":
            filepath = report_generator.export_to_md(
                final_text=req.edited_text,
                charts_paths=req.chart_paths,
                custom_name=req.project_name,
                author=req.author,
                lang=req.language,
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported format.")

        return {"status": "success", "filepath": filepath}

    except ExportError as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/api/v2/cache/{chat_id}")
def delete_project_cache(chat_id: str, user: dict = Depends(get_current_user)):
    try:
        success = storage.clear_cache(chat_id=chat_id)
        if success:
            return {
                "status": "success",
                "message": f"Cache for chat '{chat_id}' deleted successfully",
            }
        else:
            raise HTTPException(
                status_code=404, detail=f"No cache found for chat '{chat_id}'"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error while deleting cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ==========================
# FRONTEND MOUNT
# ==========================

current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dist_path = os.path.join(current_dir, "..", "frontend", "dist")

if os.path.exists(frontend_dist_path):
    app.mount(
        "/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend"
    )
    logger.info(f"Frontend mounted from: {frontend_dist_path}")
else:
    logger.warning(f"Frontend dist folder not found: {frontend_dist_path}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
