POINTS_PER_KG = {"plastic": 2, "cardboard": 1, "ewaste": 50, "metal": 10, "glass": 1, "paper": 1, "other": 0}
DEFAULT_WEIGHT_KG = {"plastic": 0.5, "cardboard": 1.0, "ewaste": 0.3, "metal": 1.0, "glass": 1.0, "paper": 1.0, "other": 1.0}

def calculate_points(category, weight_kg=None):
    if weight_kg is None: 
        weight_kg = DEFAULT_WEIGHT_KG.get(category, 0.5)
    return round(POINTS_PER_KG.get(category, 1) * weight_kg)
