import OrdersCardsDashboardV3 from "@/components/OrdersCardsDashboardV3";
import OrdersStatusController from "@/components/OrdersStatusController";
import "./orders-modern.css";

export default function OrdersPage() {
  return (
    <div className="orders-modern">
      <OrdersCardsDashboardV3 />
      <OrdersStatusController />
    </div>
  );
}
