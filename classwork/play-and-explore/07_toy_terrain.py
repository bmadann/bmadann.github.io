import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import minimize

# think of this as the height of some hilly ground at point (x, y)
def f(coordinates):
  x, y = coordinates
  return (x-2)**2 - x*y + (y-3)**2

# make a grid from -5 to 5 in both directions and get the height everywhere
x_range = np.linspace(-5, 5, 100)
y_range = np.linspace(-5, 5, 100)
X, Y = np.meshgrid(x_range, y_range)
Z = f((X, Y))

# 3d surface plot so you can actually see the bowl shape
fig = plt.figure(figsize=(10, 6))
ax = fig.add_subplot(111, projection='3d')
ax.plot_surface(X, Y, Z, cmap='viridis', edgecolor='none')
ax.set_xlabel('X')
ax.set_ylabel('Y')
ax.set_zlabel('Height')
ax.set_title('Terrain Visualization')
plt.show()
