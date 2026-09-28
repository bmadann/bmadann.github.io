# f'(x) = -2x + 4, we want where this equals 0 (that's the max)
def df(x):
    return -2 * x + 4

# pick an interval where the derivative flips sign, 2 is somewhere in here
a, b = 0.0, 3.0
tol = 1e-5

# chop the interval in half every time, 20 tries max
for step in range(20):
    c = (a + b) / 2.0
    f_c = df(c)
    if abs(f_c) < tol:
        break
    # same sign as the left end means the zero is on the right half
    if df(a) * f_c > 0:
        a = c
    else:
        b = c
    print(f"Step {step}: c = {c:.4f}")
