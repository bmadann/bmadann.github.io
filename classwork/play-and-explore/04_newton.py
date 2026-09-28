def df(x):
    return -2 * x + 4

# second derivative, constant here since f is just a parabola
def d2f(x):
    return -2

x = 0

# newton step: slope divided by curvature tells you how far to jump
for step in range(20):
    x = x - df(x) / d2f(x)
    print(f"Step {step}: x = {x:.4f}")
