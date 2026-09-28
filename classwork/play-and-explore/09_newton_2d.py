# same gradient as before, just written a little differently
def grad(xy):
  x, y = xy[0], xy[1]
  return np.array([2*(x-2) - y, -x + 2*(y-3)])

# hessian = all the second derivatives, basically the curvature in 2d
def hessian(xy):
  return np.array([[2.0, -1.0], [-1.0, 2.0]])

xy = np.array([0.0, 0.0])

# 2d newton: solve H * step = gradient instead of dividing (can't divide by a matrix)
for _ in range(5):
  g = grad(xy)
  H = hessian(xy)
  xy = xy - np.linalg.solve(H, g)

print("Final Point:", xy)
