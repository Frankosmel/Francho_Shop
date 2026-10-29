import os
import re
import subprocess
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

logger = logging.getLogger("franchoshop.uploader")

router = APIRouter(prefix="/api/upload-capturas", tags=["capturas"])

REPO_MAP = {
    "reenvio-plus": Path("/home/ubuntu/reenvio-plus-showcase"),
    "votol-tuning-pro": Path("/home/ubuntu/votol-tuning-pro-showcase")
}

@router.post("")
async def upload_capturas(
    files: list[UploadFile] = File(...),
    repo: str = Form("reenvio-plus")
):
    if repo not in REPO_MAP:
        raise HTTPException(status_code=400, detail=f"Repositorio desconocido: {repo}")

    repo_dir = REPO_MAP[repo]
    if not repo_dir.exists():
        raise HTTPException(status_code=404, detail=f"No se encontró el directorio {repo_dir}")

    screenshots_dir = repo_dir / "assets" / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    saved_filenames = []

    for f in files:
        # Sanitizar nombre
        raw_name = Path(f.filename or "cap.jpg").name
        clean_name = re.sub(r'[^a-zA-Z0-9._-]', '_', raw_name).lower()
        if not clean_name.endswith(('.jpg', '.jpeg', '.png', '.webp')):
            clean_name += '.jpg'

        dest_path = screenshots_dir / clean_name
        content = await f.read()
        dest_path.write_bytes(content)
        saved_filenames.append(clean_name)
        logger.info(f"Guardada captura: {dest_path} ({len(content)} bytes)")

    saved_filenames.sort()

    # Actualizar README.md si aplica
    readme_path = repo_dir / "README.md"
    if readme_path.exists():
        readme_text = readme_path.read_text(encoding="utf-8")
        
        # Construir bloques de imágenes
        img_tags = "\n".join([
            f'  <img src="assets/screenshots/{fname}" width="18%" alt="Captura {idx+1}" style="border-radius: 8px; margin: 3px;">'
            for idx, fname in enumerate(saved_filenames)
        ])
        new_gallery = f'<p align="center">\n{img_tags}\n</p>'

        # Reemplazar la galería de capturas existente si existe
        if "## 📸 Vista Previa" in readme_text:
            pattern = r"(## 📸 Vista Previa[^\n]*\n+)<p align=\"center\">[\s\S]*?<\/p>"
            if re.search(pattern, readme_text):
                readme_text = re.sub(pattern, rf"\1{new_gallery}", readme_text)
                readme_path.write_text(readme_text, encoding="utf-8")
        elif "## 📸 Capturas" in readme_text:
            pattern = r"(## 📸 Capturas[^\n]*\n+)<p align=\"center\">[\s\S]*?<\/p>"
            if re.search(pattern, readme_text):
                readme_text = re.sub(pattern, rf"\1{new_gallery}", readme_text)
                readme_path.write_text(readme_text, encoding="utf-8")
        else:
            # Para votol si no tiene galería, insertarla antes de Características
            if "## 🚀 ¿Qué es" in readme_text:
                gallery_section = f"\n## 📸 Vista Previa de la Aplicación\n\n{new_gallery}\n\n---\n"
                readme_text = readme_text.replace("## 🚀 ¿Qué es", f"{gallery_section}## 🚀 ¿Qué es")
                readme_path.write_text(readme_text, encoding="utf-8")

    # Ejecutar git commit y push
    git_cmd = f"cd {repo_dir} && git add assets/screenshots/ README.md && git commit -m 'update: actualizar capturas oficiales ({len(saved_filenames)} imágenes)' && git push origin main"
    res = subprocess.run(git_cmd, shell=True, capture_output=True, text=True)
    
    logger.info(f"Git push result: code={res.returncode}, stdout={res.stdout}, stderr={res.stderr}")

    return {
        "success": True,
        "repo": repo,
        "files_saved": saved_filenames,
        "git_output": res.stdout or res.stderr,
        "message": f"¡Se subieron exitosamente {len(saved_filenames)} capturas y se actualizaron en GitHub!"
    }
