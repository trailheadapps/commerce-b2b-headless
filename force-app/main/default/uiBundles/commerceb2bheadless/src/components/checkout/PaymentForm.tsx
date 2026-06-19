import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PaymentFormProps {
	readonly busy?: boolean;
	onSubmit: (poNumber: string) => void | Promise<void>;
}

// B2B purchase order payment — buyer provides a PO number; charge is invoiced
// outside of checkout. Submit places the order in one step.
export default function PaymentForm({ busy, onSubmit }: PaymentFormProps) {
	const [poNumber, setPoNumber] = useState("");
	const trimmed = poNumber.trim();
	return (
		<form
			className="space-y-3"
			onSubmit={(e) => {
				e.preventDefault();
				if (!trimmed) return;
				void onSubmit(trimmed);
			}}
		>
			<div className="space-y-1">
				<Label htmlFor="poNumber">Purchase order number</Label>
				<Input
					id="poNumber"
					value={poNumber}
					onChange={(e) => setPoNumber(e.target.value)}
					placeholder="PO-12345"
					required
					autoComplete="off"
				/>
			</div>
			<p className="text-xs text-muted-foreground">
				Your order will be placed against this PO and invoiced separately — no
				card is charged at checkout.
			</p>
			<Button type="submit" disabled={busy || !trimmed}>
				{busy ? "Placing order…" : "Place order"}
			</Button>
		</form>
	);
}
