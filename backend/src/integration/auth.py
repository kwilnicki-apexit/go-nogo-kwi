# ============================================================
# FILE: .\backend\src\integration\auth.py
# ============================================================

from fastapi import Request
from src.core.logger import get_logger

logger = get_logger("AuthAdapter")


def get_current_user(request: Request) -> dict:
    """
    Extracts the authenticated user from the request.

    Returns:
        dict with keys: username, role, display_name.
    """

    # TODO: Replace with AD/LDAP integration
    # username = request.headers.get("X-Remote-User", "")
    # role = request.headers.get("X-Remote-Role", "tester")
    # if not username:
    #     raise HTTPException(status_code=401, detail="Authentication required")
    # return {"username": username, "role": role, "display_name": username}

    return {
        "username": "dev_user",
        "role": "admin",
        "display_name": "Developer"
    }