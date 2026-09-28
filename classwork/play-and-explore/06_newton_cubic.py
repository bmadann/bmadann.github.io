# cubic has a hill AND a valley, so this one is more interesting
def f(x):
    return x**3 - 3*x

def df(x):
    return 3 * x**2 - 3

def d2f(x):
    return 6 * x

# newton wrapped in a function so we can run it from a bunch of starting spots
def newton_optimize(x0, steps=20, tol=1e-8):
    x = x0
    for step in range(steps):
        deriv2 = d2f(x)
        if deriv2 == 0:  # dividing by zero = bad time
            break
        x_new = x - df(x) / deriv2
        # stop once it basically stops moving
        if abs(x_new - x) < tol:
            x = x_new
            break
        x = x_new
    return x

# try 50 starting guesses across -5 to 5 and see where they all end up
starting_guesses = np.linspace(-5, 5, 50)
found_points = []

for x0 in starting_guesses:
    result = newton_optimize(x0)
    # only keep it if the slope is actually ~0 there and we don't already have it
    if abs(df(result)) < 1e-4:
        if not any(abs(result - p) < 1e-4 for p in found_points):
            found_points.append(result)

found_points = sorted(found_points)
print("Critical points found:", [f"{p:.4f}" for p in found_points])

# curving down = max, curving up = min
maxima = [p for p in found_points if d2f(p) < 0]
minima = [p for p in found_points if d2f(p) > 0]

x_vals = np.linspace(-3, 3, 400)
y_vals = f(x_vals)

plt.figure(figsize=(8, 6))
plt.plot(x_vals, y_vals, label="f(x) = x³ - 3x")

# stars on the max and min
plt.scatter(maxima, [f(p) for p in maxima], color="darkred", s=150, marker="*", zorder=5, label="Local max")
plt.scatter(minima, [f(p) for p in minima], color="darkblue", s=150, marker="*", zorder=5, label="Local min")

for p in maxima + minima:
    plt.annotate(f"({p:.2f}, {f(p):.2f})", (p, f(p)), textcoords="offset points", xytext=(10, 5))

plt.xlabel("x")
plt.ylabel("f(x)")
plt.title("Newton's Method: Auto-Discovering Local Max & Min")
plt.legend()
plt.grid(True)
plt.show()
