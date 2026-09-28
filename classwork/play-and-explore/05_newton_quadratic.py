import numpy as np
import matplotlib.pyplot as plt

# upside down parabola so it has a max we can go find
def f(x):
    return -x**2 + 4*x + 1

def df(x):
    return -2 * x + 4

def d2f(x):
    return -2

x = 0
points = [x]  # saving every step so we can plot the path after

for step in range(20):
    x = x - df(x) / d2f(x)
    points.append(x)
    print(f"Step {step}: x = {x:.4f}")

# plot the curve with a little padding around wherever the points ended up
x_vals = np.linspace(min(points) - 2, max(points) + 2, 400)
y_vals = f(x_vals)

plt.figure(figsize=(8, 6))
plt.plot(x_vals, y_vals, label="f(x) = -x² + 4x + 1")

# red dots = where newton landed each step
point_y = [f(p) for p in points]
plt.scatter(points, point_y, color="red", zorder=5, label="Newton iterates")

# number the dots so you can see the order
for i, (px, py) in enumerate(zip(points, point_y)):
    plt.annotate(str(i), (px, py), textcoords="offset points", xytext=(5, 5))

plt.xlabel("x")
plt.ylabel("f(x)")
plt.title("Newton's Method for Optimization (finding the maximum)")
plt.legend()
plt.grid(True)
plt.show()
