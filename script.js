import {
	render,
	html,
	svg,
	signal,
} from "https://cdn.jsdelivr.net/npm/uhtml/signal.js";

class RadarChart extends HTMLElement {
	static observedAttributes = ["dimensions", "steps", "size"];

	#internals;
	#observer;
	#dimensions;
	#items;
	#count;
	#steps;

	constructor() {
		super();

		this.#steps = signal(4);
		this.#count = signal(0);
		this.#items = signal([]);
		this.#dimensions = signal([]);
		this.#internals = this.attachInternals();
		this._onMutation = this.#onMutation.bind(this);
		this.#observer = new MutationObserver(this._onMutation);

		const shadow = this.attachShadow({ mode: "open" });
		render(
			shadow,
			() => html`
				<style>
					*,
					*:before,
					*:after {
						box-sizing: border-box;
					}
					svg {
						stroke-width: 2;
						stroke: currentColor;
						fill: none;

						.layer {
							stroke: blue;
							fill: color-mix(in oklab, blue, transparent 75%);
						}

						.guide:not([outer]) {
							opacity: 0.3;
						}

						.frame {
							stroke-width: 0;
							fill: color-mix(in oklab, currentColor, transparent 90%);
						}

						.dimension {
							transform: rotateZ(
								calc(((360deg / var(--dim-count, 5)) * var(--dim-i, 0)) + 90deg)
							);
						}
					}
				</style>
				${svg`
					<svg
						width="200"
						height="200"
						viewBox="-100 -100 200 200"
						xmlns="http://www.w3.org/2000/svg"
						class="radar-chart"
						style=${`--dim-count: ${this.#dimensions.value.length}`}
					>
						<circle class="frame" cx="0" cy="0" r="99" />
						${this.#dimensions.value.map(
							(dim, i) => svg`
							<polyline
								points="0,0 0,-100"
								class="dimension"
								style=${`--dim-i: ${i}`}
							/>
						`
						)}
						${Array.from({ length: this.#steps.value }).map(
							(u, i) => svg`
							<polygon class="guide" ?outer=${
								i + 1 == this.#steps.value
							} points="${this.#generateStepPath(i)}" />
						`
						)}
						${this.#items.value.map(
							(item, i) => svg`
							<polygon class="layer" points="${this.#generateLayerPath(item.data)}" />
						`
						)}
					</svg>
				`}
				<span>${this.#count.value}</span>
				<button
					onclick=${() => {
						console.log("click");
						this.#count.value++;
					}}
				>
					Increment
				</button>
			`
		);
	}

	connectedCallback() {
		this.#updateItemsFromChildren();

		this.#observer.observe(this, {
			subtree: true,
			childList: true,
			attributes: true,
		});
	}

	disconnectedCallback() {
		this.#observer.disconnect();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if ("dimensions" === name && oldValue !== newValue) {
			this.#updateDimensions(newValue);
		} else if ("steps" === name && oldValue !== newValue) {
			this.#updateSteps(newValue);
		}
	}

	#onMutation(records, observer) {
		records.forEach((record) => {
			console.log(record);
			if (["childList", "attributes"].includes(record.type)) {
				this.#updateItemsFromChildren();
			}
		});
	}

	#calculateCoords(value, dimIndex) {
		const degreesPerDim = 360 / this.#dimensions.value.length;
		const angle = degreesPerDim * (dimIndex + 1);

		const x = Math.cos(angle * (Math.PI / 180)) * value;
		const y = Math.sin(angle * (Math.PI / 180)) * value;

		return [x, y];
	}

	#generateLayerPath(data) {
		const points = this.#dimensions.value.map((dim, index) => {
			const value = data[dim.id] ?? 0;
			const [x, y] = this.#calculateCoords(value, index);

			return `${x},${y}`;
		});

		return points.join(" ");
	}

	#generateStepPath(i) {
		const data = {};

		this.#dimensions.value.forEach((dim) => {
			data[dim.id] = (100 / this.#steps.value) * (i + 1);
		});

		return this.#generateLayerPath(data);
	}

	#updateItemsFromChildren() {
		const allItems = this.querySelectorAll(":scope > radar-chart-item");

		this.#items.value = Array.from(allItems).map((item) => {
			const label = item.getAttribute("label");
			const data = {};

			this.#dimensions.value.forEach((dim) => {
				const _val = item.dataset[dim.id] ?? 0;
				data[dim.id] = _val;
			});

			return {
				label: label ? label : "Untitled",
				data,
			};
		});
	}

	#updateSteps(newValue) {
		const n = Number(newValue);
		if (n) {
			this.#steps.value = newValue;
		}
	}

	#updateDimensions(str) {
		const parts = str ? str.split(",") : [];

		if (parts.length > 0) {
			const newDimensions = [];
			parts.forEach((part) => {
				const items = part.split(":", 2);
				if (items.length === 2) {
					newDimensions.push({
						id: items[0],
						label: items[1],
					});
				} else {
					console.warn(`Skipped invalid dimension '${part}'.`);
				}
			});

			if (newDimensions.length > 0) {
				this.#dimensions.value = newDimensions;
			}
		}
	}
}

customElements.define("radar-chart", RadarChart);
