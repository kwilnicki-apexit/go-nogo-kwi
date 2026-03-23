# ============================================================
# FILE: .\backend\main.py
# ============================================================

from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Depends
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List

import uvicorn
import uuid
import os
import urllib.parse

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

# =============================================
# INTENT ROUTER (Auto-switch mode by keywords)
# =============================================

GONOGO_KEYWORDS = [
    "raport wdrożeniowy",
    "raport z testów",
    "go/no-go",
    "gonogo",
    "raport decyzyjny",
    "deployment report",
    "release report",
    "wygeneruj raport",
    "generate report",
    "ocena wdrożenia",
]
TRANSLATOR_KEYWORDS = [
    "przetłumacz",
    "tłumacz",
    "translate",
    "na polski",
    "na angielski",
    "to english",
    "to polish",
]
ANALYSIS_KEYWORDS = [
    "przeanalizuj",
    "analiza",
    "analyze",
    "analysis",
    "zbadaj dane",
    "examine data",
]


def detect_intent(message: str, current_mode: str) -> str:
    """
    Detects user intent from message keywords and overrides mode if needed.
    Works from ANY mode — if user types 'przetłumacz' while in gonogo,
    they get rerouted to translator.
    """
    msg_lower = message.lower().strip()

    # Check each keyword list; skip if already in that mode
    if current_mode != "gonogo":
        if any(kw in msg_lower for kw in GONOGO_KEYWORDS):
            return "gonogo"

    if current_mode != "translator":
        if any(kw in msg_lower for kw in TRANSLATOR_KEYWORDS):
            return "translator"

    if current_mode != "analysis":
        if any(kw in msg_lower for kw in ANALYSIS_KEYWORDS):
            return "analysis"

    return current_mode


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

        # ==========================================
        # INTENT ROUTER — works from ANY mode
        # ==========================================
        original_mode = mode
        mode = detect_intent(message, mode)

        if mode != original_mode:
            logger.info(
                f"Intent Router: '{original_mode}' -> '{mode}' "
                f"(keyword detected in: '{message[:80]}')"
            )

        # ==========================================

        chat_created_dir = storage.get_chat_created_dir(chat_id)
        chart_generator.output_dir = chat_created_dir
        report_generator.final_output_path = chat_created_dir

        # -------------------
        # MODE: GO/NO-GO
        # -------------------
        if mode == "gonogo":
            chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
            contents = {}

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
                    return {"message": msg, "detected_mode": mode}

                logger.info(
                    f"Re-evaluating based on {len(contents)} existing files in chat {chat_id}."
                )
                
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
                    "message": "Nie załączono żadnych prawidłowych plików tabelarycznych.",
                    "detected_mode": mode,
                }

            parsed_test_data = file_parser.extract_test_data_from_bytes(contents)

            project_instructions = ""
            if project_id:
                project_instructions = storage.load_project_instructions(project_id)

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
                "Zaktualizowałem raport uwzględniając Twoje nowe wytyczne."
                if language == "pl"
                else "Report updated with your instructions."
            )

            return {
                "message": msg_response,
                "draft_data": draft_json,
                "chart_paths": chart_paths,
                "detected_mode": mode,
            }

        # ---------------------------------------------------------
        # MODE 2: CHATBOT
        # ---------------------------------------------------------
        elif mode == "chatbot":
            chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
            contents = {}

            if not files:
                if os.path.exists(chat_uploads_dir):
                    for filename in os.listdir(chat_uploads_dir):
                        file_path = os.path.join(chat_uploads_dir, filename)
                        ext = os.path.splitext(filename)[1].lower()

                        try:
                            if ext in {".csv", ".xls", ".xlsx"}:
                                with open(file_path, "rb") as f:
                                    text_content = (
                                        file_parser.extract_test_data_from_bytes(
                                            {filename: f.read()}
                                        )
                                    )
                            else:
                                text_content = file_parser.extract_history_text(
                                    file_path
                                )

                            if text_content:
                                contents[filename] = text_content
                        except Exception as e:
                            logger.warning(f"Chatbot failed to re-read {filename}: {e}")
            else:
                for file in files:
                    content = await file.read()
                    if len(content) > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Plik {file.filename} jest za duży.",
                        )

                    file_path = os.path.join(chat_uploads_dir, file.filename)
                    with open(file_path, "wb") as f:
                        f.write(content)

                    ext = os.path.splitext(file.filename)[1].lower()
                    try:
                        if ext in {".csv", ".xls", ".xlsx"}:
                            text_content = file_parser.extract_test_data_from_bytes(
                                {file.filename: content}
                            )
                        else:
                            text_content = file_parser.extract_history_text(file_path)

                        if text_content:
                            contents[file.filename] = text_content
                            rag.ingest_document(
                                text_content, file.filename, entity_id=chat_id
                            )
                    except Exception as e:
                        logger.warning(
                            f"Chatbot failed to process {file.filename}: {e}"
                        )

            project_instructions = ""
            if project_id:
                project_instructions = storage.load_project_instructions(project_id)

            search_query = message if message else "Podsumowanie plików"
            rag_context = rag.search_context(
                query=search_query, project_id=project_id, chat_id=chat_id
            )

            context_block = ""
            if project_instructions or rag_context:
                context_block += "[BAZA WIEDZY PROJEKTU I RAG]\n"
                if project_instructions:
                    context_block += f"Wytyczne projektu: {project_instructions}\n"
                if rag_context:
                    context_block += f"Materiały referencyjne:\n{rag_context}\n"

            if contents:
                context_block += "\n[ZAŁĄCZONE PLIKI DO AKTUALNEJ ANALIZY]\n"
                for fname, txt in contents.items():
                    context_block += f"--- Plik: {fname} ---\n{txt}\n\n"

            if language == "pl":
                sys_prompt = (
                    "Jesteś WYŁĄCZNIE asystentem konwersacyjnym (Chatbot). Twoim zadaniem jest prowadzenie ogólnej rozmowy i odpowiadanie na pytania.\n"
                    "MASZ SUROWY ZAKAZ wykonywania zadań zarezerwowanych dla innych modułów:\n"
                    "1) NIE WOLNO Ci tłumaczyć tekstów ani dokumentów.\n"
                    "2) NIE WOLNO Ci generować ustrukturyzowanych raportów Go/No-Go ani decydować o wdrożeniach.\n"
                    "3) NIE WOLNO Ci pełnić roli zaawansowanego analityka (Remedy).\n"
                    "Jeśli użytkownik poprosi Cię o wykonanie któregoś z tych zadań, STANOWCZO ODMÓW i poinstruuj go, "
                    "aby użył odpowiedniego modułu z menu poniżej (Tłumacz, Go/No-Go, Analiza). Nie próbuj nawet częściowo wykonywać tych zadań."
                )
            else:
                sys_prompt = (
                    "You are EXCLUSIVELY a conversational assistant (Chatbot). Your task is general conversation and answering questions.\n"
                    "YOU ARE STRICTLY FORBIDDEN from performing tasks reserved for other modules:\n"
                    "1) DO NOT translate texts or documents.\n"
                    "2) DO NOT generate structured Go/No-Go reports or make deployment decisions.\n"
                    "3) DO NOT act as an advanced data analyst (Remedy).\n"
                    "If the user asks you to perform any of these tasks, FIRMLY REFUSE and instruct them "
                    "to use the appropriate module from the menu below (Translator, Go/No-Go, Analysis). Do not even attempt to partially fulfill these requests."
                )

            user_prompt = f"{context_block}\n[ZAPYTANIE UŻYTKOWNIKA]\n{message}"
            reply = llm.generate_response(sys_prompt, user_prompt, temperature=0.3)
            return {"message": reply, "detected_mode": mode}

        # ---------------------------------------------------------
        # MODE 3: TRANSLATOR
        # ---------------------------------------------------------
        elif mode == "translator":
            chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
            contents = {}

            if not files:
                if os.path.exists(chat_uploads_dir):
                    for filename in os.listdir(chat_uploads_dir):
                        ext = os.path.splitext(filename)[1].lower()

                        if ext in {".txt", ".md", ".docx", ".pdf"}:
                            file_path = os.path.join(chat_uploads_dir, filename)
                            text_content = file_parser.extract_history_text(file_path)
                            if text_content:
                                contents[filename] = text_content
            else:
                for file in files:
                    content = await file.read()
                    if len(content) > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Plik {file.filename} jest za duży.",
                        )

                    ext = os.path.splitext(file.filename)[1].lower()
                    if ext not in {".txt", ".md", ".docx", ".pdf"}:
                        continue

                    file_path = os.path.join(chat_uploads_dir, file.filename)
                    with open(file_path, "wb") as f:
                        f.write(content)

                    text_content = file_parser.extract_history_text(file_path)
                    if text_content:
                        contents[file.filename] = text_content
                        try:
                            rag.ingest_document(
                                text_content, file.filename, entity_id=chat_id
                            )
                        except Exception as e:
                            logger.warning(f"Could not vectorize {file.filename}: {e}")

            text_to_translate = ""
            if contents:
                text_to_translate = "\n\n".join(
                    [f"--- Plik: {fname} ---\n{txt}" for fname, txt in contents.items()]
                )

            if not text_to_translate and not message:
                msg = (
                    "Proszę wpisać tekst do przetłumaczenia lub załączyć pliki (TXT, PDF, DOCX)."
                    if language == "pl"
                    else "Please enter text to translate or attach files (TXT, PDF, DOCX)."
                )
                return {"message": msg, "detected_mode": mode}

            project_instructions = ""
            if project_id:
                project_instructions = storage.load_project_instructions(project_id)

            search_query = message if message else text_to_translate[:500]
            rag_context = rag.search_context(
                query=search_query, project_id=project_id, chat_id=chat_id
            )

            if language == "pl":
                sys_prompt = (
                    "Jesteś WYŁĄCZNIE modułem tłumaczącym. Twoim jedynym zadaniem jest precyzyjny przekład tekstu (domyślnie PL ↔ EN).\n"
                    "MASZ SUROWY ZAKAZ: 1) Prowadzenia konwersacji. 2) Odpowiadania na zadane pytania (jeśli użytkownik zadaje pytanie, po prostu je przetłumacz!). 3) Analizowania kodu czy danych.\n"
                    "Cokolwiek użytkownik napisze w polu zapytania, potraktuj to JAKO TEKST DO PRZETŁUMACZENIA (chyba że to jawna instrukcja zmiany stylu tłumaczenia).\n"
                    "Zwracaj WYŁĄCZNIE przetłumaczony tekst, bez żadnych wstępów, komentarzy i wyjaśnień."
                )
            else:
                sys_prompt = (
                    "You are EXCLUSIVELY a translation module. Your only task is precise text translation (default PL ↔ EN).\n"
                    "YOU ARE STRICTLY FORBIDDEN from: 1) Engaging in conversation. 2) Answering questions (if the user asks a question, just translate the question itself!). 3) Analyzing code or data.\n"
                    "Whatever the user writes, treat it AS TEXT TO TRANSLATE (unless it is a clear instruction on translation style).\n"
                    "Return ONLY the translated text, with no introductions, comments, or explanations."
                )

            context_block = ""
            if project_instructions or rag_context:
                context_block = "[KONTEKST PROJEKTU I SŁOWNICZEK (RAG)]\n"
                if project_instructions:
                    context_block += f"Reguły projektu: {project_instructions}\n"
                if rag_context:
                    context_block += f"Materiały referencyjne (użyj do zachowania spójności słownictwa):\n{rag_context}\n"
                context_block += "\nWykorzystaj powyższy kontekst, aby dostosować tłumaczenie do standardów i nomenklatury projektu.\n\n"

            user_prompt = context_block

            if text_to_translate and message:
                user_prompt += f"Instrukcja od użytkownika: {message}\n\nTekst z dokumentów do przetłumaczenia:\n{text_to_translate}"
            elif text_to_translate:
                user_prompt += f"Przetłumacz poniższy tekst z dokumentów (wykryj język i przetłumacz na drugi - PL/EN):\n\n{text_to_translate}"
            else:
                user_prompt += f"Przetłumacz lub wykonaj polecenie:\n\n{message}"

            logger.info(f"Executing translator mode for chat {chat_id}")
            reply = llm.generate_response(sys_prompt, user_prompt, temperature=0.2)

            return {"message": reply, "detected_mode": mode}

        elif mode == "analysis":
            return {
                "message": f"Analysis module. Files received: {len(files)}",
                "detected_mode": mode,
            }

        else:
            return {
                "message": "Unknown mode of operation.",
                "detected_mode": mode,
            }

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
# CHAT FILES MANAGEMENT ENDPOINTS
# ==========================================
@app.get("/api/v2/chat/{chat_id}/files/{filename}")
async def download_chat_file(
    chat_id: str, filename: str, user: dict = Depends(get_current_user)
):
    """Download a file from the chat uploads directory."""
    try:
        chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
        file_path = os.path.join(chat_uploads_dir, filename)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        encoded_filename = urllib.parse.quote(filename)
        return FileResponse(
            path=file_path,
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/api/v2/chat/{chat_id}/files/{filename}")
async def delete_chat_file(
    chat_id: str, filename: str, user: dict = Depends(get_current_user)
):
    """Delete a file from the chat uploads directory."""
    try:
        chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
        file_path = os.path.join(chat_uploads_dir, filename)

        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"File {filename} deleted from disk for chat {chat_id}")

        try:
            rag.delete_document(filename=filename, entity_id=chat_id)
        except Exception as e:
            logger.warning(f"Failed to delete {filename} from RAG vector store: {e}")

        return {
            "status": "success",
            "message": f"Plik {filename} został pomyślnie usunięty z dysku i bazy wektorowej.",
        }
    except Exception as e:
        logger.error(f"Error deleting file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ==========================================
# EXPORT ENDPOINT & CACHE
# ==========================================
@app.post("/api/v2/reports/export")
def export_report(req: ExportRequest, user: dict = Depends(get_current_user)):
    try:
        fmt = req.format.lower()

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

        # AUTO-VECTORIZATION OF EXPORTED REPORT (RAG)
        try:
            text_content = file_parser.extract_history_text(filepath)
            if text_content:
                filename = os.path.basename(filepath)
                rag.ingest_document(text_content, filename, entity_id=req.project_name)
                logger.info(
                    f"Auto-vectorized exported report {filename} into chat {req.project_name}"
                )
        except Exception as e:
            logger.warning(f"Failed to auto-vectorize exported report: {e}")

        filename = os.path.basename(filepath)
        encoded_filename = urllib.parse.quote(filename)
        return FileResponse(
            path=filepath,
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            },
        )

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
