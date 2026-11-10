"""Local, line-delimited inference worker. stdout is reserved for JSON replies."""
import base64
import json
import os
import sys
from contextlib import redirect_stdout
from pathlib import Path

os.environ.setdefault("YOLO_AUTOINSTALL", "False")
root = Path(__file__).resolve().parents[1]
os.environ.setdefault("YOLO_CONFIG_DIR", str(root / "training" / "config"))
with redirect_stdout(sys.stderr):
    import cv2
    import numpy as np
    import torch
    from ultralytics import YOLO
    model = YOLO(str(root / "training" / "runs" / "pothole" / "weights" / "best.pt"))
    device = 0 if torch.cuda.is_available() else "cpu"

for line in sys.stdin:
    try:
        image_bytes = base64.b64decode(line.strip(), validate=True)
        frame = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None or frame.shape[0] * frame.shape[1] > 1280 * 1280:
            raise ValueError("Invalid image")
        with redirect_stdout(sys.stderr):
            result = model.predict(frame, imgsz=640, conf=0.35, device=device, verbose=False)[0]
        height, width = frame.shape[:2]
        boxes = []
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            boxes.append({"x1": max(0, x1 / width), "y1": max(0, y1 / height),
                          "x2": min(1, x2 / width), "y2": min(1, y2 / height),
                          "confidence": float(box.conf[0])})
        print(json.dumps({"boxes": boxes}), flush=True)
    except Exception as exc:
        print(json.dumps({"error": "Unable to analyze the image"}), flush=True)
        print(f"Detection error: {type(exc).__name__}", file=sys.stderr, flush=True)
