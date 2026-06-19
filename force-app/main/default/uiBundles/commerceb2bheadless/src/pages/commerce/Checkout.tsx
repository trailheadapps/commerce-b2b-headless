import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import AddressForm from "@/components/addresses/AddressForm";
import CheckoutStepper, { type CheckoutStep } from "@/components/checkout/CheckoutStepper";
import OrderSummary from "@/components/cart/OrderSummary";
import PaymentForm from "@/components/checkout/PaymentForm";
import SavedAddressPicker from "@/components/addresses/SavedAddressPicker";
import ShippingMethods from "@/components/checkout/ShippingMethods";
import { COMMERCE_ROUTES } from "@/config/commerce";
import { useCart } from "@/context/CartContext";
import { useCheckout } from "@/hooks/useCheckout";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import type { CheckoutAddress, DeliveryMethod, SavedAddress } from "@/api/types";

// Single-page, 3-step flow (address → delivery → payment+place-order).
// Each step advances after its server call succeeds; payment authorises and
// submits in one click so there's no separate review pause.
export default function CheckoutPage() {
	const navigate = useNavigate();
	const {
		summary: cartSummary,
		items: cartItems,
		cartPromotions,
		approachingDiscounts,
		refreshSummary,
		refreshItems,
	} = useCart();
	const { checkout, loading, busy, error, start, setShippingAddress, selectDeliveryMethod, authorise, submit } =
		useCheckout();

	const [step, setStep] = useState<CheckoutStep>("address");
	const [shippingAddress, setShippingAddressState] = useState<CheckoutAddress | undefined>();
	// When saved addresses exist, show the picker first; user can switch to
	// the manual form with "Add a new address".
	const [addressMode, setAddressMode] = useState<"picker" | "form">("picker");
	// When editing an existing address, hold its id + initial values so the
	// form pre-fills and submit hits PATCH instead of POST.
	const [editingAddress, setEditingAddress] = useState<{
		id: string;
		initial: CheckoutAddress;
	} | null>(null);
	const [busyAddressId, setBusyAddressId] = useState<string | undefined>();
	// Address pending deletion — drives the in-app confirm dialog.
	const [pendingDeleteId, setPendingDeleteId] = useState<string | undefined>();

	const {
		addresses: savedAddresses,
		loading: savedLoading,
		saving: addressSaving,
		save: saveAddress,
		update: updateAddress,
		remove: removeAddress,
	} = useSavedAddresses("Shipping");

	// Ensure an active checkout exists. If the server has none, spin one up.
	useEffect(() => {
		if (loading) return;
		if (!checkout) {
			start(cartSummary?.cartId).catch(() => {
				// error already captured in the hook
			});
		}
	}, [loading, checkout, cartSummary?.cartId, start]);

	// Hydrate cart line items so the side-panel summary can render product
	// names + prices alongside totals.
	useEffect(() => {
		refreshItems();
	}, [refreshItems]);

	const availableMethods = useMemo<readonly DeliveryMethod[]>(() => {
		const group = checkout?.deliveryGroups?.items?.[0];
		return group?.availableDeliveryMethods ?? [];
	}, [checkout]);

	const selectedDeliveryId = checkout?.deliveryGroups?.items?.[0]?.selectedDeliveryMethod?.id;
	const selectedShippingFee =
		checkout?.deliveryGroups?.items?.[0]?.selectedDeliveryMethod?.shippingFee;

	// Applies an already-known address to the checkout (used by the picker:
	// the address is already in the address book).
	const applyAddress = async (addr: CheckoutAddress) => {
		try {
			await setShippingAddress(addr);
			setShippingAddressState(addr);
			setStep("delivery");
		} catch (err) {
			// useCheckout populates `error` for the step alert; the toast adds
			// explicit feedback so the user knows the action failed (otherwise the
			// step just doesn't advance, which is silent).
			toast.error(err instanceof Error ? err.message : "Could not save shipping address");
		}
	};

	// Save a new address to the buyer's address book and stay on the address
	// step. The new entry shows up in the picker; the buyer then clicks
	// "Use this address" to actually apply it to the checkout. Decoupling
	// save from apply lets the buyer review the saved entry first and gives
	// the picker a chance to render the new card before advancing.
	const saveOnly = async (addr: CheckoutAddress) => {
		try {
			if (editingAddress) {
				await updateAddress(editingAddress.id, addr);
				toast.success("Address updated");
				setEditingAddress(null);
			} else {
				await saveAddress(addr, savedAddresses.length === 0);
				toast.success("Address saved");
			}
			setAddressMode("picker");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to save address");
		}
	};

	const handleEditAddress = (saved: SavedAddress) => {
		setEditingAddress({
			id: saved.addressId,
			initial: {
				firstName: saved.firstName,
				lastName: saved.lastName,
				companyName: saved.companyName,
				street: saved.street,
				city: saved.city,
				region: saved.region,
				postalCode: saved.postalCode,
				country: saved.country,
			},
		});
		setAddressMode("form");
	};

	// Click handler on the trash icon — opens the confirm dialog instead
	// of deleting straight away.
	const askDeleteAddress = (addressId: string) => {
		setPendingDeleteId(addressId);
	};

	const confirmDeleteAddress = async () => {
		if (!pendingDeleteId) return;
		const addressId = pendingDeleteId;
		setBusyAddressId(addressId);
		try {
			await removeAddress(addressId);
			toast.success("Address deleted");
			setPendingDeleteId(undefined);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to delete address");
		} finally {
			setBusyAddressId(undefined);
		}
	};

	const handleDelivery = async (id: string) => {
		try {
			await selectDeliveryMethod(id);
			setStep("payment");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not set delivery method");
		}
	};

	// Payment + place order in one step. Authorise records the PO against
	// the cart; submit converts cart → order. Both run sequentially so a
	// failure in either surfaces to the buyer before the order is committed.
	const handlePayment = async (poNumber: string) => {
		if (!shippingAddress) {
			toast.error("Shipping address is missing");
			return;
		}
		try {
			await authorise(poNumber, shippingAddress);
			const result = await submit();
			await refreshSummary();
			// /order-summaries/actions/lookup accepts either a summary id or a
			// reference number, so prefer the ref number (always present).
			const orderKey =
				result.orderReferenceNumber ?? result.orderSummaryId ?? result.salesOrderId ?? "";
			if (result.orderReferenceNumber) {
				toast.success(`Order ${result.orderReferenceNumber} placed`);
			} else {
				toast.success("Order placed");
			}
			navigate(COMMERCE_ROUTES.ORDER(orderKey));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not place order");
		}
	};

	if (loading) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
			<h1 className="text-2xl font-semibold">Checkout</h1>
			<CheckoutStepper current={step} />
			{error && (
				<Alert variant="destructive">
					<AlertTitle>Checkout error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
				<div className="space-y-4">
					{step === "address" && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Shipping address</CardTitle>
							</CardHeader>
							<CardContent>
								{savedLoading ? (
									<Skeleton className="h-24 w-full" />
								) : addressMode === "picker" && savedAddresses.length > 0 ? (
									<SavedAddressPicker
										addresses={savedAddresses}
										busyAddressId={busyAddressId}
										applying={busy}
										onSelect={(addr) => applyAddress(addr)}
										onAddNew={() => {
											setEditingAddress(null);
											setAddressMode("form");
										}}
										onEdit={handleEditAddress}
										onDelete={askDeleteAddress}
									/>
								) : (
									<div className="space-y-3">
										<AddressForm
											initial={
												editingAddress?.initial ??
												checkout?.deliveryGroups?.items?.[0]?.deliveryAddress ??
												checkout?.deliveryAddress ??
												checkout?.shippingAddress
											}
											busy={addressSaving}
											submitLabel={editingAddress ? "Update address" : "Save address"}
											busyLabel={editingAddress ? "Updating…" : "Saving…"}
											onSubmit={saveOnly}
										/>
										{savedAddresses.length > 0 && (
											<Button
												variant="link"
												size="sm"
												className="px-0"
												onClick={() => {
													setEditingAddress(null);
													setAddressMode("picker");
												}}
											>
												← Back to saved addresses
											</Button>
										)}
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{step === "delivery" && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Delivery method</CardTitle>
							</CardHeader>
							<CardContent>
								<ShippingMethods
									methods={availableMethods}
									selectedId={selectedDeliveryId}
									busy={busy}
									onSelect={handleDelivery}
								/>
							</CardContent>
						</Card>
					)}

					{step === "payment" && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Payment</CardTitle>
							</CardHeader>
							<CardContent>
								<PaymentForm busy={busy} onSubmit={handlePayment} />
							</CardContent>
						</Card>
					)}
				</div>
				<OrderSummary
					summary={checkout?.cartSummary ?? cartSummary}
					items={cartItems}
					shippingAmount={selectedShippingFee}
					promotions={cartPromotions}
					approachingDiscounts={approachingDiscounts}
				/>
			</div>
			<Dialog
				open={!!pendingDeleteId}
				onOpenChange={(open) => {
					if (!open) setPendingDeleteId(undefined);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this address?</DialogTitle>
						<DialogDescription>
							This will remove the address from your saved address book. You can
							always add it again later.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setPendingDeleteId(undefined)}
							disabled={!!busyAddressId}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDeleteAddress}
							disabled={!!busyAddressId}
						>
							{busyAddressId ? "Deleting…" : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
