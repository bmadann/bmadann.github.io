# partial derivatives of the terrain, one for x and one for y
def grad_f(v):
    x, y = v[0], v[1]
    dx = 2*x - y - 4
    dy = -x + 2*y - 6
    return np.array([dx, dy])

v = np.array([0.0, 0.0])  # start at the origin
alpha = 0.1
epochs = 100

# descent this time so we SUBTRACT, walking downhill to the bottom of the bowl
for epoch in range(epochs):
    grad = grad_f(v)
    v = v - alpha * grad
print("Final Point:", v)
