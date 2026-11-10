# Pothole detection training starter

This is a starting point for training, not a trained detector. The dashboard does not yet run this model. You need a labeled dataset and a separate Python environment. Training and downloading pretrained weights require internet access. Ultralytics licensing should be reviewed for your intended use.

## Prepare data

Collect road-facing images representative of the truck camera: varied roads, lighting, weather and pothole sizes. Include images without potholes, including confusing surfaces such as manholes, shadows and road repairs. Use images you have permission to use and review privacy before sharing.

Draw a box around each visible pothole and export object-detection labels in YOLO format, with one class named `pothole` (class ID 0). Each label row is `0 x_center y_center width height` with coordinates normalized to 0–1. Images without objects may have no label file. Check that every positive image has the matching label filename; missing positive labels teach the model that potholes are background.

Split by drive, route or recording session before extracting frames, not by random neighboring frames. Keep separate roads or sessions for the final test set. A starting split is 70% train, 15% validation, 15% test by recording session; adjust for adequate coverage. Do not use the test set to tune the model. Store as:

```text
my-pothole-data/
  images/train/  images/val/  images/test/
  labels/train/  labels/val/  labels/test/
```

## Train on Windows

Install a supported Python version separately, then from the project directory:

```powershell
py -m venv .venv-pothole
.\.venv-pothole\Scripts\python.exe -m pip install ultralytics
.\.venv-pothole\Scripts\python.exe training\train.py 'C:\path\to\my-pothole-data'
```

The pretrained model weights download on first use. The script writes `roadwatch-dataset.yaml` in the dataset folder and stores results under `training/runs/`. Use `--device cpu` to request CPU training; this can take a long time. Hardware support depends on the installed PyTorch version.

## Evaluate

Use validation results for model selection; report precision, recall and mAP on the untouched test set and examine false detections and missed potholes. Evaluate actual road video separately, including speed and processing delay, on hardware intended for use. A detected pothole is a possible event for owner review, not proof of a driver's fault. Camera detection alone does not provide accelerometer data.

Documentation: https://docs.ultralytics.com/datasets/detect/ and https://docs.ultralytics.com/modes/train/
