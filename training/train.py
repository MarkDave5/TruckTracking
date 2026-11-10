"""Train a single-class pothole detector on a prepared YOLO dataset."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="Dataset root with images/{train,val,test} and labels/{train,val,test}")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--device", default=None, help="For example cpu or 0; omit for automatic selection")
    args = parser.parse_args()
    root = args.dataset.resolve()
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    for split in ("train", "val", "test"):
        images = root / "images" / split
        labels = root / "labels" / split
        if not images.is_dir() or not labels.is_dir():
            parser.error(f"Missing {images} or {labels}. Prepare all three splits first.")
        if not any(p.suffix.lower() in extensions for p in images.iterdir() if p.is_file()):
            parser.error(f"No images found in {images}.")
    if not any(p.read_text(encoding="utf-8").strip() for p in (root / "labels" / "train").glob("*.txt")):
        parser.error("No labeled training boxes found. Label potholes before training.")
    try:
        from ultralytics import YOLO
    except ImportError:
        parser.error("Ultralytics is not installed. See training/README.md.")
    config = root / "roadwatch-dataset.yaml"
    config.write_text(f"path: {json.dumps(root.as_posix())}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n  0: pothole\n", encoding="utf-8")
    options = dict(data=str(config), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, workers=0, project=str(Path(__file__).resolve().parent / "runs"), name="pothole")
    if args.device:
        options["device"] = args.device
    model = YOLO("yolo26n.pt")
    model.train(**options)
    print("Training complete. Evaluate the selected best checkpoint on the held-out test set before deployment.")


if __name__ == "__main__":
    main()
