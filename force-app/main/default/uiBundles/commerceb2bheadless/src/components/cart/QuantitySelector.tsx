import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

export interface QuantitySelectorProps {
	readonly value: number;
	readonly min?: number;
	readonly max?: number;
	readonly disabled?: boolean;
	onChange: (next: number) => void;
}

export default function QuantitySelector({
	value,
	min = 1,
	max = 9999,
	disabled,
	onChange,
}: QuantitySelectorProps) {
	const clamp = (n: number) => Math.max(min, Math.min(max, n));
	return (
		<div className="inline-flex items-center gap-1">
			<Button
				type="button"
				variant="outline"
				size="icon"
				disabled={disabled || value <= min}
				onClick={() => onChange(clamp(value - 1))}
				aria-label="Decrease quantity"
			>
				<Minus className="h-4 w-4" />
			</Button>
			<Input
				type="number"
				className="w-16 text-center"
				value={value}
				min={min}
				max={max}
				disabled={disabled}
				onChange={(e) => {
					const n = Number(e.target.value);
					if (Number.isFinite(n)) onChange(clamp(n));
				}}
			/>
			<Button
				type="button"
				variant="outline"
				size="icon"
				disabled={disabled || value >= max}
				onClick={() => onChange(clamp(value + 1))}
				aria-label="Increase quantity"
			>
				<Plus className="h-4 w-4" />
			</Button>
		</div>
	);
}
