import sys
from pathlib import Path

from app.classifier import classify_image

folder = Path(sys.argv[1])
for path in sorted(folder.iterdir()):
    try:
        result = classify_image(path.read_bytes())
        print(f"{path.name:25} -> {result['category']:10} {result['confidence']}")
    except Exception as error:
        print(f"{path.name:25} -> ERROR {error}")