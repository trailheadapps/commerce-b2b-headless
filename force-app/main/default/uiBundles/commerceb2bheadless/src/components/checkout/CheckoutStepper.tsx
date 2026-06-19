import { Check } from "lucide-react";

export type CheckoutStep = "address" | "delivery" | "payment";

const STEPS: ReadonlyArray<{ id: CheckoutStep; label: string }> = [
	{ id: "address", label: "Address" },
	{ id: "delivery", label: "Delivery" },
	{ id: "payment", label: "Payment" },
];

export interface CheckoutStepperProps {
	readonly current: CheckoutStep;
}

// Compact progress indicator for the checkout flow.
export default function CheckoutStepper({ current }: CheckoutStepperProps) {
	const currentIdx = STEPS.findIndex((s) => s.id === current);
	return (
		<ol className="flex items-center gap-2 overflow-x-auto py-2">
			{STEPS.map((step, idx) => {
				const done = idx < currentIdx;
				const active = idx === currentIdx;
				return (
					<li key={step.id} className="flex items-center gap-2">
						<div
							className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium border ${
								done
									? "bg-primary text-primary-foreground border-primary"
									: active
										? "border-primary text-primary"
										: "border-muted-foreground/30 text-muted-foreground"
							}`}
						>
							{done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
						</div>
						<span
							className={`text-sm ${active ? "font-medium" : "text-muted-foreground"}`}
						>
							{step.label}
						</span>
						{idx < STEPS.length - 1 && (
							<div
								className={`w-6 h-px ${done ? "bg-primary" : "bg-muted-foreground/30"}`}
							/>
						)}
					</li>
				);
			})}
		</ol>
	);
}
