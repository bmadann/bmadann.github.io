<!--

-->

Can an evolutionary algorithm design a quantum circuit? That's the question in [Bhandari, Nichele, Denysov and Lind (2025)](https://arxiv.org/abs/2408.00448), and it mashed together two things I wanted to understand. This class showed me EAs can search spaces we can't reason through by hand, and quantum circuits are definitely one of those. So the plan was to learn enough quantum to read the paper, rebuild the algorithm myself, and check its claims. The checking ended up being the fun part.

## The idea

Circuits are hard to design by hand. There are a ton of possible gate arrangements, and quantum behavior doesn't really follow everyday intuition. So the paper treats a circuit like a genome: each gene is a gate plus the qubits it acts on, and you let selection and mutation do the searching.

The EA itself is pretty simple. Start with 20 random circuits, score them, keep the best 4, and fill the rest with mutated copies. No crossover. There are two tasks: imitate a cellular automaton (scored with KL divergence, lower is better) and create as much entanglement as possible (scored with the Meyer–Wallach measure, or MW, higher is better).

## Rebuilding it

The quantum background was the hardest part for me. The way I think about MW now: look at one qubit by itself and ask how random it seems. If it's entangled with the rest, it looks like a perfect coin flip. Three Hadamards give every bitstring equal odds and still score 0, because each qubit is independent. Superposition isn't entanglement.

The authors' code uses an old Qiskit API that doesn't work anymore, so I created a small NumPy simulator and checked it against Qiskit on 200 random circuits. They matched to about $10^{-16}$. Then I gave the EA 3 qubits, 3 gates and no hints, and it found the textbook GHZ circuit with a perfect score of 1. Pretty cool to watch.

Some things matched the paper. Cranking mutation from 5% to 80% dropped the population average from 0.90 to 0.32, but the best circuit still hit 1 because elitism protects it. And if you take away the two-qubit gates, the score stays at exactly 0 forever. An EA can only find what its representation can express.

## Where I stopped agreeing

The paper reports that 5 qubits with 12 gates only reached 0.199, versus 0.999 with 5 gates, and concludes that more complex circuits entangle worse. That seemed off to me. A 12-gate circuit can do anything a 5-gate one can, since extra gates can just cancel out. A low score should mean a harder search, not a worse circuit.

So I tested it. With two different gate pools, 12 gates hit MW = 1 in all 6 runs, and I couldn't reproduce the 0.199. My setup isn't an exact copy of theirs and one run can just get stuck, but "the EA didn't find it" and "the circuit can't do it" are different claims.

The cellular automaton task had a surprise too. If you add up $P(q_0 = 1)$ over all 8 inputs, you get exactly 4 for any 3-qubit circuit, because $\mathrm{Tr}[U^\dagger P_1 U] = \mathrm{Tr}[P_1] = 4$. Rule 110 has five 1s, so no circuit can match it exactly. So how does the paper get a KL near 0?

It's the fitness function. Normalizing the values means only the shape has to match. My evolved circuit got a KL of 0.007 while firing only 75% of the time where the rule says 100%. A stricter version gave 1.36. The EA did exactly what it was told.

I also read the authors' public code. Its MW function seems to keep the same pair of qubits every loop, and running a copy gave me a 2×2 array instead of a number, one that rates an unentangled $|000\rangle$ well above zero. I'm not saying the paper's results are wrong, since the figures may have come from a different version of the code. It's probably worth asking the authors.

## What I took from it

The approach works, within limits. The search space and the simulation cost both blow up fast, the paper stops at 5 qubits, and there's no noise in the simulator. Evolving circuits makes sense when there's no known construction or hardware rules out the textbook answer. For GHZ it's overkill.

The bigger lessons aren't really about quantum. A genome limits what you can find. A fitness function rewards what you wrote, not what you meant. And a weird result is a reason to go look. The notebook below is set up so you can do that yourself: change the settings, make a prediction, and try to break it.
