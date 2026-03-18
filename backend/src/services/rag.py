# ============================================================
# FILE: .\backend\src\services\rag.py
# ============================================================

import os
import hashlib
from typing import Optional, List

import chromadb
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.core.config import Config
from src.core.logger import get_logger


# Singleton for embedder to avoid loading the model multiple times
_embedder = None


def get_embedder():
    """Returns a singleton SentenceTransformer instance for embedding generation."""
    global _embedder
    if _embedder is None:
        model_name = os.getenv(
            "EMBED_MODEL", "sdadas/st-polish-paraphrase-from-distilroberta"
        )
        _embedder = SentenceTransformer(model_name)
    return _embedder


class RAGEngine:
    """Retrieval-Augmented Generation engine using ChromaDB and parent-child chunking."""

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

        self.parent_chunk_size = Config.PARENT_CHUNK_SIZE
        self.parent_chunk_overlap = Config.PARENT_CHUNK_OVERLAP
        self.child_chunk_size = Config.CHILD_CHUNK_SIZE
        self.child_chunk_overlap = Config.CHILD_CHUNK_OVERLAP
        self.top_k = Config.TOP_K
        self.score_threshold = Config.SCORE_THRESHOLD

        # Main ChromaDB client — encapsulates all collections (projects & chats)
        self.chroma_path = os.path.join(Config.BASE_DATA_PATH, "chroma_db")
        os.makedirs(self.chroma_path, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=self.chroma_path)

    def _get_collection(self, collection_name: str):
        """Gets or creates a ChromaDB collection (isolated vector store)."""

        class _EmbFn(chromadb.EmbeddingFunction):
            def __call__(self, input: List[str]) -> List[List[float]]:
                return get_embedder().encode(input, show_progress_bar=False).tolist()

        return self.chroma_client.get_or_create_collection(
            name=collection_name,
            embedding_function=_EmbFn(),
            metadata={"hnsw:space": "cosine"},
        )

    def _chunk_parent_child(self, text: str) -> List[dict]:
        """Splits text using parent-child chunking strategy."""
        parent_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.parent_chunk_size,
            chunk_overlap=self.parent_chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        child_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.child_chunk_size,
            chunk_overlap=self.child_chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

        results = []
        for p_idx, p_text in enumerate(parent_splitter.split_text(text)):
            for c_idx, c_text in enumerate(child_splitter.split_text(p_text)):
                results.append(
                    {"parent_id": p_idx, "parent_text": p_text, "child_text": c_text}
                )
        return results

    def delete_document(self, filename: str, entity_id: str):
        """
        Removes vectors associated with a specific file from the entity's collection.
        """
        if not filename or not entity_id:
            return

        safe_collection_name = entity_id.replace("-", "_")
        try:
            collection = self._get_collection(safe_collection_name)

            collection.delete(
                where={"$and": [{"source": filename}, {"entity_id": entity_id}]}
            )
            self.logger.info(
                f"Deleted vectors for file {filename} from collection {safe_collection_name}"
            )
        except Exception as e:
            self.logger.warning(
                f"Error while deleting document {filename} from collection {safe_collection_name}: {e}"
            )

    def ingest_document(self, text: str, filename: str, entity_id: str):
        """
        Vectorizes and indexes text into a collection based on entity_id.

        Args:
            text: The document text to ingest.
            filename: Original filename for metadata.
            entity_id: 'p-12345' (project) or 'c-98765' (chat).
        """
        if not text.strip():
            return

        safe_collection_name = entity_id.replace("-", "_")
        collection = self._get_collection(safe_collection_name)

        chunks = self._chunk_parent_child(text)
        ids, docs, metas = [], [], []

        for i, c in enumerate(chunks):
            # Unique hash for each chunk to enable idempotent upserts
            chunk_hash = hashlib.md5(
                f"{filename}_{i}_{c['child_text'][:50]}".encode()
            ).hexdigest()
            ids.append(f"{filename}_c{chunk_hash[:10]}")
            docs.append(c["child_text"])

            metas.append(
                {
                    "source": filename,
                    "parent_text": c["parent_text"],
                    "entity_id": entity_id,
                }
            )

        collection.upsert(ids=ids, documents=docs, metadatas=metas)
        self.logger.info(
            f"Indexed {filename} into {safe_collection_name} ({len(chunks)} vectors)"
        )

    def search_context(
        self, query: str, project_id: Optional[str], chat_id: str
    ) -> str:
        """
        Searches both project and chat vector stores and returns merged context.

        Args:
            query: The search query text.
            project_id: Optional project ID to search project-level documents.
            chat_id: Chat ID to search chat-level documents.

        Returns:
            Concatenated RAG context string from best-matching chunks.
        """
        all_hits = []

        # Search project-level collection if chat is linked to a project
        if project_id:
            safe_proj = project_id.replace("-", "_")
            all_hits.extend(self._search_collection(query, safe_proj))

        # Always search chat-level collection
        safe_chat = chat_id.replace("-", "_")
        all_hits.extend(self._search_collection(query, safe_chat))

        if not all_hits:
            return ""

        all_hits.sort(key=lambda x: x["score"], reverse=True)
        best_hits = all_hits[: self.top_k]

        rag_parts = []
        seen_texts = set()

        for hit in best_hits:
            if hit["text"] not in seen_texts:
                rag_parts.append(f"[File: {hit['source']}]\n{hit['text']}")
                seen_texts.add(hit["text"])

        return "\n\n---\n\n".join(rag_parts)

    def _search_collection(self, query: str, collection_name: str) -> List[dict]:
        """Searches a single ChromaDB collection and returns scored hits."""
        try:
            collection = self._get_collection(collection_name)
            if collection.count() == 0:
                return []

            results = collection.query(
                query_texts=[query],
                n_results=self.top_k,
                include=["documents", "metadatas", "distances"],
            )

            hits = []
            for i in range(len(results["ids"][0])):
                score = 1 - results["distances"][0][i]
                if score >= self.score_threshold:
                    meta = results["metadatas"][0][i]
                    text_to_use = meta.get("parent_text", results["documents"][0][i])
                    hits.append(
                        {
                            "text": text_to_use,
                            "source": meta.get("source", "?"),
                            "score": score,
                        }
                    )
            return hits
        except Exception as e:
            self.logger.warning(
                f"Error while searching collection {collection_name}: {e}"
            )
            return []

    # ─── Deprecated stubs (kept for backward compatibility) ──────

    def get_historical_context(self, lang="pl") -> str:
        """Deprecated: RAG context is now handled by search_context()."""
        return ""

    def load_structured_rules(self, lang="pl") -> str:
        """Deprecated: No longer used."""
        return ""

    def save_approved_report(
        self, project_name: str, report_data: dict, lang: str = "pl"
    ) -> str:
        """Deprecated: No longer used."""
        return ""

    def update_structured_rules(self, rules: list, lang: str, author: str) -> str:
        """Deprecated: No longer used."""
        return ""
