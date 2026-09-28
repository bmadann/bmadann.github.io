import numpy as np

# two equations we want to both equal zero at the same time
# (this is the himmelblau pair, classic test problem)
def residuals(xy):
    x, y = xy[0], xy[1]
    r1 = x**2 + y - 11
    r2 = x + y**2 - 7
    return np.array([r1, r2])

# jacobian = how much each residual changes when you nudge x or y
def jacobian(xy):
    x, y = xy[0], xy[1]
    return np.array([
        [2*x, 1.0],
        [1.0, 2*y]
    ])

xy = np.array([0.0, 0.0])
for _ in range(20):
    r = residuals(xy)
    J = jacobian(xy)
    # gauss-newton trick: use J^T J as a stand in for the hessian, then solve for the step
    JTJ = J.T @ J
    JTr = J.T @ r
    delta = np.linalg.solve(JTJ, -JTr)
    xy = xy + delta

# if the residual norm is ~0 then both equations are solved
print("Final Point:", xy)
print("Residual norm:", np.linalg.norm(residuals(xy)))
