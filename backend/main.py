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
import re

from src.integration.llm_client import LLMClient
from src.integration.auth import get_current_user
from src.services.rag import RAGEngine
from src.services.file_parser import FileParser
from src.services.storage import StorageManager
from src.services.report_generator import ReportGenerator
from src.services.chart_generator import ChartGenerator
from src.core.logger import get_logger, request_id_var
from src.core.exceptions import LLMConnectionError, DataProcessingError, ExportError
from src.utils.validators import (
    validate_message,
    validate_upload,
    validate_mime,
    assert_within_directory,
    normalize_extracted_text,
    security_logger,
    GONOGO_ALLOWED_EXTENSIONS,
    PROJECT_ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    MAX_FILES,
)

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


@app.middleware("http")
async def set_utf8_content_type(request: Request, call_next):
    """4.5.3 — jawna deklaracja charset=utf-8 na każdej odpowiedzi JSON."""
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type and "charset" not in content_type:
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response

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
        # 4.6.4 — sanitizacja project_id z URL path parametru
        project_id = re.sub(r"[^a-zA-Z0-9\-_]", "", project_id)[:64]
        if not project_id:
            raise HTTPException(status_code=400, detail="Nieprawidłowy project_id.")

        proj_uploads_dir = storage.get_project_uploads_dir(project_id)
        ingested_count = 0
        
        if len(files) > MAX_FILES:
            security_logger.warning(
                "Validation failed: too many files | count=%d | limit=%d | project_id=%s",
                len(files), MAX_FILES, project_id,
            )
            raise HTTPException(
                status_code=400,
                detail=f"Zbyt wiele plików ({len(files)}). Maksymalna liczba to {MAX_FILES} na raz.",
            )

        for file in files:
            content = await file.read()

            # 4.5.5 / 4.5.6 — centralny walidator (wcześniej brak jakiejkolwiek walidacji)
            safe_name, content = validate_upload(
                file.filename, content, PROJECT_ALLOWED_EXTENSIONS
            )
            # 4.6.1 — MIME / magic bytes
            validate_mime(safe_name, content)

            file_path = os.path.join(proj_uploads_dir, safe_name)
            # 4.6.4 — path confinement
            assert_within_directory(file_path, proj_uploads_dir)

            with open(file_path, "wb") as f:
                f.write(content)

            # Extract text from PDF/DOCX/TXT via FileParser and ingest into RAG
            text_content = file_parser.extract_history_text(file_path)

            # 4.5.7 — normalizacja przed indeksowaniem w RAG
            text_content = normalize_extracted_text(text_content)

            if text_content:
                rag.ingest_document(text_content, safe_name, entity_id=project_id)
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
        # ── NOWE — 4.5.1 / 4.5.2 ──────────────────────────────────────────
        message = validate_message(message)
        # ──────────────────────────────────────────────────────────────────

        if chat_id:
            chat_id = re.sub(r"[^a-zA-Z0-9\-_]", "", chat_id)[:64]
        if project_id:
            project_id = re.sub(r"[^a-zA-Z0-9\-_]", "", project_id)[:64]

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
                if len(files) > MAX_FILES:
                    security_logger.warning(
                        "Validation failed: too many files | count=%d | limit=%d | chat_id=%s",
                        len(files), MAX_FILES, chat_id,
                    )
                    raise HTTPException(
                        status_code=400,
                        detail=f"Zbyt wiele plików ({len(files)}). Maksymalna liczba to {MAX_FILES} na raz.",
                    )
                for file in files:
                    content = await file.read()

                    # 4.5.5 / 4.5.6 — centralny walidator plików
                    safe_name, content = validate_upload(
                        file.filename, content, GONOGO_ALLOWED_EXTENSIONS
                    )
                    # 4.6.1 — MIME / magic bytes
                    validate_mime(safe_name, content)

                    file_path = os.path.join(chat_uploads_dir, safe_name)
                    # 4.6.4 — path confinement
                    assert_within_directory(file_path, chat_uploads_dir)

                    with open(file_path, "wb") as f:
                        f.write(content)

                    contents[safe_name] = content

                    try:
                        text_content = file_parser.extract_test_data_from_bytes(
                            {safe_name: content}
                        )
                        # 4.5.7 — normalizacja tekstu wyodrębnionego z pliku
                        text_content = normalize_extracted_text(text_content)
                        rag.ingest_document(text_content, safe_name, entity_id=chat_id)
                    except Exception as e:
                        logger.warning(f"Could not vectorize {safe_name}: {e}")
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
            chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
            contents = {}

            # REEVALUATION
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

            # STANDARD
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
                    "Jesteś wszechstronnym asystentem QA i inżynierem oprogramowania. "
                    "Obecnie działasz w ogólnym trybie 'Chatbot' (Q&A).\n"
                    "Jeśli użytkownik dostarczył pliki (w sekcji ZAŁĄCZONE PLIKI) lub kontekst RAG, odnoś się do nich w swoich odpowiedziach i analizuj je zgodnie z poleceniem.\n\n"
                    "BĄDŹ ŚWIADOMY innych trybów: Jeśli użytkownik poprosi o formalny raport 'Go/No-Go' z testów lub profesjonalne, dokładne tłumaczenie dokumentu "
                    "(a nie tylko streszczenie), wykonaj polecenie najlepiej jak umiesz, ale na końcu odpowiedzi przypomnij mu, że do takich zadań posiada dedykowane tryby "
                    "dostępne pod polem wpisywania wiadomości (Tryb Go/No-Go generuje interaktywne wykresy i PDFy, a Tryb Tłumacza oferuje najwyższą jakość przekładu)."
                )
            else:
                sys_prompt = (
                    "You are a versatile QA assistant and software engineer. "
                    "You are currently operating in the general 'Chatbot' (Q&A) mode.\n"
                    "If the user provided files (in the ATTACHED FILES section) or RAG context, refer to them in your answers and analyze them according to the prompt.\n\n"
                    "BE AWARE of other modes: If the user asks for a formal 'Go/No-Go' report from test data or a professional translation of a document, "
                    "do your best to fulfill the request, but at the end of your message, politely remind them that they have dedicated modes for these tasks "
                    "below the chat input (Go/No-Go mode generates interactive charts and PDFs, while Translator mode ensures top-quality translation)."
                )

            user_prompt = f"{context_block}\n[ZAPYTANIE UŻYTKOWNIKA]\n{message}"

            reply = llm.generate_response(sys_prompt, user_prompt, temperature=0.3)
            return {"message": reply}

        # ---------------------------------------------------------
        # MODE 3: TRANSLATOR
        # ---------------------------------------------------------
        elif mode == "translator":
            chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
            contents = {}

            # REEVALUATION
            if not files:
                if os.path.exists(chat_uploads_dir):
                    for filename in os.listdir(chat_uploads_dir):
                        ext = os.path.splitext(filename)[1].lower()

                        if ext in {".txt", ".md", ".docx", ".pdf"}:
                            file_path = os.path.join(chat_uploads_dir, filename)
                            text_content = file_parser.extract_history_text(file_path)
                            if text_content:
                                contents[filename] = text_content

            # STANDARD
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
                return {"message": msg}

            project_instructions = ""
            if project_id:
                project_instructions = storage.load_project_instructions(project_id)

            search_query = message if message else text_to_translate[:500]
            rag_context = rag.search_context(
                query=search_query, project_id=project_id, chat_id=chat_id
            )

            if language == "pl":
                sys_prompt = (
                    "Jesteś profesjonalnym, zaawansowanym tłumaczem technicznym. "
                    "Twoim zadaniem jest precyzyjne tłumaczenie tekstów (domyślnie z polskiego na angielski lub z angielskiego na polski), zachowując odpowiedni ton i słownictwo branżowe. "
                    "Zwracaj WYŁĄCZNIE przetłumaczony tekst, bez żadnych wstępów, pozdrowień i uwag, chyba że użytkownik jawnie prosi o analizę lub korektę."
                )
            else:
                sys_prompt = (
                    "You are a professional, advanced technical translator. "
                    "Your task is to accurately translate texts (default PL ↔ EN) while maintaining the correct tone and industry vocabulary. "
                    "Return ONLY the translated text, without any introductions or notes, unless the user explicitly asks for analysis or proofreading."
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

            return {"message": reply}

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
