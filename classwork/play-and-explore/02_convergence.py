def df(x):
    return -2 * (x - 2)

x = 0.0
alpha = 0.1
tol = 1e-6          # "close enough to flat" cutoff
max_epochs = 1000   # safety cap so it can't loop forever

# same climb as before but now it stops itself once the slope is basically 0
for epoch in range(max_epochs):
    grad = df(x)
    if abs(grad) < tol:
        print(f"Converged at step {epoch}: x = {x:.4f}")
        break
    x = x + alpha * grad
    print(f"Step {epoch}: x = {x:.4f}")
