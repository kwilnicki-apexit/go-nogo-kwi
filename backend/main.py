# ============================================================
# FILE: .\backend\main.py
# ============================================================

import re

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
import unicodedata
import json

from src.integration.llm_client import LLMClient
from src.integration.auth import get_current_user
from src.services.rag import RAGEngine, get_embedder
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


@app.middleware("http")
async def set_utf8_content_type(request: Request, call_next):
    """
    Middleware that ensures UTF-8 charset is explicitly declared in JSON response headers.

    This middleware checks if the response content-type is 'application/json' and lacks
    a charset declaration. If so, it adds 'charset=utf-8' to the content-type header.

    This addresses requirement 4.5.3 - ensuring explicit UTF-8 charset declaration on
    every JSON response.

    Args:
        request (Request): The incoming HTTP request object.
        call_next: The next middleware or route handler in the chain.

    Returns:
        Response: The response object with updated content-type header if applicable.
    """
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type and "charset" not in content_type:
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service initialization
try:
    logger.info("Loading embedding model for RAG engine...")
    get_embedder()

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
    add_to_rag: bool = False


# =============================================
# INTENT ROUTER (Auto-switch mode by keywords)
# =============================================
def remove_diacritics(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


GONOGO_KEYWORDS = [
    "raport wdrożeniowy",
    "raport wdrozeniowy",
    "raport z testów",
    "raport z testow",
    "go/no-go",
    "gonogo",
    "raport decyzyjny",
    "deployment report",
    "release report",
    "wygeneruj raport",
    "generate report",
    "zrób raport",
    "zrob raport",
    "stwórz raport",
    "stworz raport",
    "ocena wdrożenia",
    "ocena wdrozenia",
]

TRANSLATOR_KEYWORDS = [
    "przetłumacz",
    "przetlumacz",
    "tłumacz",
    "tlumacz",
    "translate",
    "na polski",
    "na angielski",
    "to english",
    "to polish",
]


async def detect_intent_llm(
    message: str, current_mode: str, llm_client: LLMClient
) -> str:
    """Hybrydowy detektor intencji."""
    msg_lower = message.lower().strip()
    msg_no_diacritics = remove_diacritics(msg_lower)

    if current_mode != "gonogo" and any(
        kw in msg_lower or kw in msg_no_diacritics for kw in GONOGO_KEYWORDS
    ):
        return "gonogo"
    if current_mode != "translator" and any(
        kw in msg_lower or kw in msg_no_diacritics for kw in TRANSLATOR_KEYWORDS
    ):
        return "translator"

    if len(message.strip()) < 5:
        return current_mode

    router_sys_prompt = (
        "Jesteś szybkim klasyfikatorem intencji użytkownika w aplikacji QA. "
        "Twoim zadaniem jest przypisanie zapytania użytkownika do jednego z trybów: "
        "'chatbot', 'gonogo', 'translator'.\n"
        "Reguły:\n"
        "- 'gonogo': Jeśli użytkownik chce wygenerować raport, ocenić testy lub wdrożenie, przeanalizować CSV pod kątem decyzji.\n"
        "- 'translator': Jeśli użytkownik wyraźnie prosi o tłumaczenie tekstu/pliku.\n"
        "- 'chatbot': Domyślny tryb do zadawania pytań, analizy logów i ogólnej rozmowy.\n"
        f"Obecny tryb to: '{current_mode}'. Jeśli zapytanie jest dwuznaczne lub to kontynuacja rozmowy, zwróć obecny tryb.\n"
        'Zwróć WYŁĄCZNIE obiekt JSON w formacie: {"mode": "wybrany_tryb"}'
    )

    try:
        reply = llm_client.generate_response(
            system_prompt=router_sys_prompt,
            user_prompt=message,
            temperature=0.0,
            max_tokens=50,
            force_json=True,
        )
        mode_data = json.loads(reply)
        detected_mode = mode_data.get("mode", current_mode)

        if detected_mode in ["chatbot", "gonogo", "translator"]:
            return detected_mode
        return current_mode
    except Exception as e:
        logger.warning(f"LLM Intent Router failed, falling back to current mode: {e}")
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
    try:
        # SANITIZATION
        project_id = re.sub(r"[^a-zA-Z0-9\-_]", "", project_id)[:64]
        if not project_id:
            raise HTTPException(status_code=400, detail="Nieprawidłowy project_id.")

        proj_uploads_dir = storage.get_project_uploads_dir(project_id)
        ingested_count = 0

        # VALIDATION
        if len(files) > MAX_FILES:
            security_logger.warning("Validation failed: too many files")
            raise HTTPException(
                status_code=400,
                detail=f"Zbyt wiele plików ({len(files)}). Maksymalnie {MAX_FILES}.",
            )

        for file in files:
            content = await file.read()

            # SECURE VALIDATION
            safe_name, content = validate_upload(
                file.filename, content, PROJECT_ALLOWED_EXTENSIONS
            )
            validate_mime(safe_name, content)

            file_path = os.path.join(proj_uploads_dir, safe_name)
            assert_within_directory(file_path, proj_uploads_dir)

            with open(file_path, "wb") as f:
                f.write(content)

            text_content = file_parser.extract_history_text(file_path)
            if text_content:
                text_content = normalize_extracted_text(text_content)
                rag.ingest_document(text_content, safe_name, entity_id=project_id)
                ingested_count += 1

        return {
            "status": "success",
            "message": f"Uploaded and vectorized {ingested_count} file(s).",
        }
    except Exception as e:
        logger.error(f"Failed to upload project files: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ==========================================
# MODE HANDLERS
# ==========================================
async def _handle_gonogo(
    chat_id: str,
    project_id: str,
    message: str,
    language: str,
    files: List[UploadFile],
    chat_history: List[dict],
) -> dict:
    chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
    contents = {}

    # ALWAYS PRIORITIZE EXISTING FILES ON DISK (for continuity) - only if no new files in request
    if os.path.exists(chat_uploads_dir):
        for filename in os.listdir(chat_uploads_dir):
            ext = os.path.splitext(filename)[1].lower()
            if ext in GONOGO_ALLOWED_EXTENSIONS:
                file_path = os.path.join(chat_uploads_dir, filename)
                with open(file_path, "rb") as f:
                    contents[filename] = f.read()

    # IF NEW FILES ARE UPLOADED - VALIDATE, SAVE, INGEST
    valid_files = [f for f in files if getattr(f, "filename", "")]
    if valid_files:
        if len(valid_files) > MAX_FILES:
            raise HTTPException(
                status_code=400, detail=f"Too many files. Maximal count is {MAX_FILES}."
            )

        for file in valid_files:
            content = await file.read()
            try:
                safe_name, content = validate_upload(
                    file.filename, content, GONOGO_ALLOWED_EXTENSIONS
                )
                validate_mime(safe_name, content)
            except HTTPException as e:
                logger.warning(f"Skipping invalid file {file.filename}: {e.detail}")
                continue

            file_path = os.path.join(chat_uploads_dir, safe_name)
            assert_within_directory(file_path, chat_uploads_dir)

            with open(file_path, "wb") as f:
                f.write(content)

            contents[safe_name] = content

            try:
                text_content = file_parser.extract_test_data_from_bytes(
                    {safe_name: content}
                )
                text_content = normalize_extracted_text(text_content)
                parsed_parts.append(text_content)
                rag.ingest_document(text_content, safe_name, entity_id=chat_id)
            except Exception as e:
                logger.warning(f"Could not vectorize {safe_name}: {e}")

    # IF NO FILES AT ALL (neither new nor old) - return early with message
    if not contents:
        msg = (
            "Aby wygenerować raport Go/No-Go, proszę załącz pliki (CSV/XLS)."
            if language == "pl"
            else "Please attach files."
        )
        return {"message": msg, "detected_mode": "gonogo"}

    parsed_test_data = "\n\n".join(parsed_parts)

    project_instructions = (
        storage.load_project_instructions(project_id) if project_id else ""
    )
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

    fallback_msg = "Zaktualizowałem raport." if language == "pl" else "Report updated."
    msg_response = draft_json.get("assistant_reply", fallback_msg)

    chat_history.append({"role": "assistant", "content": msg_response})
    storage.save_to_cache(chat_id=chat_id, structured_data=draft_json, parsed_test_data=parsed_test_data)
    storage.save_chat_history(chat_id, chat_history)

    return {
        "message": msg_response,
        "draft_data": draft_json,
        "chart_paths": chart_paths,
        "detected_mode": "gonogo",
    }


async def _handle_chatbot(
    chat_id: str,
    project_id: str,
    message: str,
    language: str,
    files: List[UploadFile],
    chat_history: List[dict],
) -> dict:
    chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
    contents = {}

    if not files:
        if os.path.exists(chat_uploads_dir):
            for filename in os.listdir(chat_uploads_dir):
                file_path = os.path.join(chat_uploads_dir, filename)
                ext = os.path.splitext(filename)[1].lower()

                try:
                    if ext in GONOGO_ALLOWED_EXTENSIONS:
                        with open(file_path, "rb") as f:
                            text_content = file_parser.extract_test_data_from_bytes(
                                {filename: f.read()}
                            )
                    else:
                        text_content = file_parser.extract_history_text(file_path)

                    if text_content:
                        contents[filename] = text_content
                except Exception as e:
                    logger.warning(f"Chatbot failed to re-read {filename}: {e}")
    else:
        if len(files) > MAX_FILES:
            raise HTTPException(
                status_code=400, detail=f"Zbyt wiele plików. Maks to {MAX_FILES}."
            )

        combined_extensions = frozenset(
            GONOGO_ALLOWED_EXTENSIONS | PROJECT_ALLOWED_EXTENSIONS
        )
        for file in files:
            content = await file.read()

            try:
                # VALIDATION (kolega)
                safe_name, content = validate_upload(
                    file.filename, content, combined_extensions
                )
                validate_mime(safe_name, content)
            except HTTPException as e:
                logger.warning(f"Skipping invalid file {file.filename}: {e.detail}")
                continue

            file_path = os.path.join(chat_uploads_dir, safe_name)
            assert_within_directory(file_path, chat_uploads_dir)

            with open(file_path, "wb") as f:
                f.write(content)

            ext = os.path.splitext(safe_name)[1].lower()
            try:
                if ext in GONOGO_ALLOWED_EXTENSIONS:
                    text_content = file_parser.extract_test_data_from_bytes(
                        {safe_name: content}
                    )
                else:
                    text_content = file_parser.extract_history_text(file_path)

                if text_content:
                    text_content = normalize_extracted_text(text_content)
                    contents[safe_name] = text_content
                    rag.ingest_document(text_content, safe_name, entity_id=chat_id)
            except Exception as e:
                logger.warning(f"Chatbot failed to process {safe_name}: {e}")

    project_instructions = (
        storage.load_project_instructions(project_id) if project_id else ""
    )
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
            "Jesteś konwersacyjnym asystentem QA (Chatbot). Twoim zadaniem jest merytoryczna rozmowa, odpowiadanie na pytania i analiza luźnych zagadnień.\n"
            "WAŻNE: Użytkownik ma możliwość załączania plików. System parsował je i wstrzyknął ich treść w bloku [ZAŁĄCZONE PLIKI DO AKTUALNEJ ANALIZY].\n"
            "NIGDY nie mów, że nie masz dostępu do plików. Sprawdź nagłówki i poinformuj, co widzisz.\n"
            "Pamiętaj, że w tej aplikacji istnieją dedykowane moduły do innych zadań: 'Go/No-Go' do raportów decyzyjnych oraz 'Tłumacz' do translacji.\n"
            "Nie masz uprawnień do generowania ustrukturyzowanych raportów wdrożeniowych ani bezpośredniego tłumaczenia całych dokumentów."
        )
    else:
        sys_prompt = (
            "You are a conversational QA assistant (Chatbot).\n"
            "IMPORTANT: You have full access to files injected by the backend under [ATTACHED FILES]. Never claim you cannot see files.\n"
            "Remember this app has dedicated modules: 'Go/No-Go' for structured reports and 'Translator'. Do not duplicate their specific tasks."
        )

    user_prompt = f"{context_block}\n[ZAPYTANIE UŻYTKOWNIKA]\n{message}"
    reply = llm.generate_response(
        sys_prompt, user_prompt, temperature=0.3, chat_history=chat_history[-8:]
    )

    chat_history.append({"role": "assistant", "content": reply})
    storage.save_chat_history(chat_id, chat_history)

    return {"message": reply, "detected_mode": "chatbot"}


async def _handle_translator(
    chat_id: str,
    project_id: str,
    message: str,
    language: str,
    files: List[UploadFile],
    chat_history: List[dict],
) -> dict:
    chat_uploads_dir = storage.get_chat_uploads_dir(chat_id)
    contents = {}

    if not files:
        if os.path.exists(chat_uploads_dir):
            for filename in os.listdir(chat_uploads_dir):
                ext = os.path.splitext(filename)[1].lower()
                if ext in PROJECT_ALLOWED_EXTENSIONS:
                    file_path = os.path.join(chat_uploads_dir, filename)
                    text_content = file_parser.extract_history_text(file_path)
                    if text_content:
                        contents[filename] = text_content
    else:
        if len(files) > MAX_FILES:
            raise HTTPException(status_code=400, detail=f"Zbyt wiele plików.")

        for file in files:
            content = await file.read()
            try:
                # VALIDATION
                safe_name, content = validate_upload(
                    file.filename, content, PROJECT_ALLOWED_EXTENSIONS
                )
                validate_mime(safe_name, content)
            except HTTPException as e:
                logger.warning(f"Skipping invalid file {file.filename}: {e.detail}")
                continue

            file_path = os.path.join(chat_uploads_dir, safe_name)
            assert_within_directory(file_path, chat_uploads_dir)

            with open(file_path, "wb") as f:
                f.write(content)

            text_content = file_parser.extract_history_text(file_path)
            if text_content:
                text_content = normalize_extracted_text(text_content)
                contents[safe_name] = text_content
                try:
                    rag.ingest_document(text_content, safe_name, entity_id=chat_id)
                except Exception as e:
                    logger.warning(f"Could not vectorize {safe_name}: {e}")

    # ==========================================
    # HYBRID SOURCE DETECTION
    # ==========================================
    text_from_files = ""
    if contents:
        text_from_files = "\n\n".join(
            [f"--- Plik: {fname} ---\n{txt}" for fname, txt in contents.items()]
        )

    source_text = ""
    instruction = ""

    if text_from_files:
        source_text = text_from_files
        instruction = (
            message
            if message
            else (
                "Przetłumacz poniższe pliki"
                if language == "pl"
                else "Translate the files below"
            )
        )
    elif message and len(message.strip()) > 15:
        source_text = message
        instruction = (
            "Przetłumacz poniższy tekst (wykryj język i przetłumacz na drugi - PL/EN)."
            if language == "pl"
            else "Translate the following text."
        )
    elif chat_history:
        history_to_search = (
            chat_history[:-1]
            if (message and chat_history and chat_history[-1].get("content") == message)
            else chat_history
        )
        if history_to_search:
            source_text = history_to_search[-1].get("content", "")
            instruction = (
                message
                if message
                else ("Przetłumacz to" if language == "pl" else "Translate this")
            )

    if not source_text and not message and not contents:
        msg = (
            "Proszę wpisać tekst, załączyć pliki lub poprosić o przetłumaczenie poprzedniej wiadomości."
            if language == "pl"
            else "Please provide input."
        )
        return {"message": msg, "detected_mode": "translator"}

    # ==========================================
    # RAG & PROMPTS
    # ==========================================
    project_instructions = (
        storage.load_project_instructions(project_id) if project_id else ""
    )
    search_query = message if message else source_text[:500]
    rag_context = rag.search_context(
        query=search_query, project_id=project_id, chat_id=chat_id
    )

    if language == "pl":
        sys_prompt = (
            "Jesteś modułem tłumaczącym (Translator). Twoim zadaniem jest precyzyjny przekład tekstu (domyślnie PL ↔ EN).\n"
            "Zawsze zachowuj wierność i profesjonalizm. Odpowiadaj bezpośrednio tłumaczonym tekstem."
        )
    else:
        sys_prompt = "You are a translation module. Your task is precise text translation. Respond directly with the translated text."

    context_block = ""
    if project_instructions or rag_context:
        context_block = "[KONTEKST PROJEKTU I SŁOWNICZEK (RAG)]\n"
        if project_instructions:
            context_block += f"Reguły projektu: {project_instructions}\n"
        if rag_context:
            context_block += f"Materiały referencyjne:\n{rag_context}\n"
        context_block += "\nWykorzystaj powyższy kontekst do tłumaczenia.\n\n"

    user_prompt = context_block
    user_prompt += f"Instrukcja od użytkownika: {instruction}\n\nTekst docelowy do przetłumaczenia:\n{source_text}"

    logger.info(f"Executing hybrid translator mode for chat {chat_id}")
    reply = llm.generate_response(
        sys_prompt, user_prompt, temperature=0.2, chat_history=chat_history[-8:]
    )

    chat_history.append({"role": "assistant", "content": reply})
    storage.save_chat_history(chat_id, chat_history)

    return {"message": reply, "detected_mode": "translator"}


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

        if chat_id:
            chat_id = re.sub(r"[^a-zA-Z0-9\-_]", "", chat_id)[:64]
        if project_id:
            project_id = re.sub(r"[^a-zA-Z0-9\-_]", "", project_id)[:64]

        if project_id in ["", "null", "undefined", "default"]:
            project_id = None

        if not chat_id:
            raise HTTPException(
                status_code=400, detail="No chat_id provided in the request"
            )

        message = validate_message(message, require_non_empty=False)

        # CACHE MEMORY (load history from cache if exists)
        chat_history = storage.load_chat_history(chat_id)

        if message.strip():
            chat_history.append({"role": "user", "content": message})

        # INTENT ROUTER — works from ANY mode
        original_mode = mode
        mode = await detect_intent_llm(message, mode, llm)

        if mode != original_mode:
            logger.info(
                f"Intent Router: '{original_mode}' -> '{mode}' "
                f"(keyword detected in: '{message[:80]}')"
            )

        chat_created_dir = storage.get_chat_created_dir(chat_id)
        chart_generator.output_dir = chat_created_dir
        report_generator.final_output_path = chat_created_dir

        if mode == "gonogo":
            return await _handle_gonogo(
                chat_id=chat_id,
                project_id=project_id,
                message=message,
                language=language,
                files=files,
                chat_history=chat_history,
            )

        elif mode == "chatbot":
            return await _handle_chatbot(
                chat_id=chat_id,
                project_id=project_id,
                message=message,
                language=language,
                files=files,
                chat_history=chat_history,
            )

        elif mode == "translator":
            return await _handle_translator(
                chat_id=chat_id,
                project_id=project_id,
                message=message,
                language=language,
                files=files,
                chat_history=chat_history,
            )

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

        assert_within_directory(file_path, chat_uploads_dir)

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

        assert_within_directory(file_path, chat_uploads_dir)

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
        if req.add_to_rag:
            try:
                text_content = file_parser.extract_history_text(filepath)
                if text_content:
                    text_content = normalize_extracted_text(text_content)
                    filename = os.path.basename(filepath)
                    rag.ingest_document(
                        text_content, filename, entity_id=req.project_name
                    )
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
