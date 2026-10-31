POINTS_PER_KG = {"plastic": 2, "cardboard": 1, "ewaste": 50}
DEFAULT_WEIGHT_KG = {"plastic": 0.5, "cardboard": 1.0, "ewaste": 0.3}

def calculate_points(category, weight_kg=None):
    if weight_kg is None:
        weight_kg = DEFAULT_WEIGHT_KG.get(category, 0.5)
    return round(POINTS_PER_KG.get(category, 1) * weight_kg)
