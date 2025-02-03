import {
	render,
	html,
	svg,
	signal,
} from "https://cdn.jsdelivr.net/npm/uhtml/signal.js";

class RadarChart extends HTMLElement {
	static observedAttributes = ["dimensions", "steps", "width", "height"];

	#internals;
	#observer;
	#dimensions;
	#items;
	#steps;
	#width;
	#height;

	constructor() {
		super();

		this.#steps = signal(4);
		this.#width = signal(250);
		this.#height = signal(250);
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
					:host {
						display: inline-block;
					}
					svg {
						width: 100%;
						height: auto;
						stroke-width: 2;
						stroke: currentColor;
						fill: none;

						.layer {
							stroke: var(--rc-accent, blue);
							fill: color-mix(
								in oklab,
								var(--rc-accent, blue),
								transparent 75%
							);

							&.disabled {
								display: none;
							}
						}

						&:has(.layer:hover) .layer:not(:hover) {
							opacity: 0.35;
						}

						.guide:not([outer]) {
							opacity: 0.3;
						}

						.frame {
							stroke-width: 0;
							fill: color-mix(in oklab, currentColor, transparent 90%);
						}

						.dimension {
						}

						.label {
							font-size: 16px;
							font-family: inherit;
							stroke: none;
							fill: currentColor;
							position: relative;
							z-index: 2;
							text-anchor: middle;
							dominant-baseline: middle;

							&.right {
								text-anchor: start;
							}

							&.left {
								text-anchor: end;
							}
						}
					}
				</style>
				${svg`
					<svg
						width=${this.#width.value}
						height=${this.#height.value}
						viewBox=${`${this.#width.value / -2} ${this.#height.value / -2} ${
							this.#width.value
						} ${this.#height.value}`}
						xmlns="http://www.w3.org/2000/svg"
						class="radar-chart"
						style=${`--dim-count: ${this.#dimensions.value.length}`}
					>
						<circle class="frame" cx="0" cy="0" r="99" />
						${Array.from({ length: this.#steps.value }).map(
							(u, i) => svg`
							<polygon class="guide" ?outer=${
								i + 1 == this.#steps.value
							} points="${this.#generateStepPath(i)}" />
						`
						)}
						${this.#dimensions.value.map(
							(dim, i) => svg`
							<g>
							<title>${dim.label}</title>
							<polyline
							points=${"0,0 " + this.#calculateCoords(100, i)}
							class="dimension"
							style=${`--dim-i: ${i}`}
							/>
							<text x="${this.#calculateX(105, i)}" y="${this.#calculateY(
								110,
								i
							)}" class=${`label ${this.#calculateLabelSide(110, i)}`}>${
								dim.label
							}</text>
									</g>
									`
						)}
						${this.#items.value.map(
							(item, i) => svg`
							<g class=${`layer${item.disabled ? " disabled" : ""}`} style=${
								item.color ? `--rc-accent: ${item.color};` : null
							}>
								<title>${item.label}</title>
								<polygon points="${this.#generateLayerPath(item.data)}" />
							</g>
						`
						)}
					</svg>
				`}
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
		} else if (["width", "height"].includes(name) && oldValue !== newValue) {
			const n = newValue ? Number(newValue) : 250;
			if ("width" === name) {
				this.#width.value = n;
			} else {
				this.#height.value = n;
			}
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

	#calculateX(value, dimIndex) {
		return this.#calculateCoords(value, dimIndex)[0];
	}

	#calculateY(value, dimIndex) {
		return this.#calculateCoords(value, dimIndex)[1];
	}

	#calculateLabelSide(value, dimIndex) {
		const x = this.#calculateX(value, dimIndex);
		if (x < -20) {
			return "left";
		} else if (-20 >= x >= 20) {
			return "center";
		} else {
			return "right";
		}
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
			const disabled = item.hasAttribute("disabled");
			const color = item.getAttribute("color");

			this.#dimensions.value.forEach((dim) => {
				const _val = item.dataset[dim.id] ?? 0;
				data[dim.id] = _val;
			});

			return {
				disabled: disabled,
				label: label ? label : "Untitled",
				data,
				color,
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
