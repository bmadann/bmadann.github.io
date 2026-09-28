import numpy as np
import matplotlib.pyplot as plt

# derivative of f(x) = -(x - 2)^2, so the peak should be at x = 2
def df(x):
    return -2 * (x - 2)

# start at 0, take small steps, and just run a fixed number of times
x = 0.0
alpha = 0.1   # step size, too big and it bounces around
epochs = 48

# ascent = we ADD the gradient since we're climbing up, not down
for epoch in range(epochs):
    grad = df(x)
    x = x + alpha * grad
    print(f"Step {epoch}: x = {x:.4f}")
