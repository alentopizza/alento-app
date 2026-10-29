const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Usuario creado",
  USER_UPDATED: "Usuario actualizado",
  ORDER_CANCELED: "Pedido cancelado",
  ORDER_UPDATED: "Pedido actualizado",
  ORDER_CUSTOMER_CHANGED: "Cliente del pedido actualizado",
  ORDER_STATUS_CHANGED: "Estado del pedido actualizado",
  ORDER_DELETED: "Pedido eliminado",
  ORDER_DISCOUNT_APPLIED: "Descuento aplicado",
  PAYMENT_CREATED: "Pago registrado",
  PAYMENT_DELETED: "Pago eliminado",
  PAYMENT_REFUNDED: "Devolución registrada",
  CASH_SESSION_OPENED: "Caja abierta",
  CASH_OPENING_UPDATED: "Apertura de caja actualizada",
  CASH_SESSION_CLOSED: "Caja cerrada",
  CASH_INCOME_CREATED: "Ingreso de caja registrado",
  CASH_INCOME_DELETED: "Ingreso de caja eliminado",
  CASH_EXPENSE_CREATED: "Salida de caja registrada",
  CASH_EXPENSE_UPDATED: "Salida de caja actualizada",
  CASH_EXPENSE_DELETED: "Salida de caja eliminada",
  DRIVER_PAYOUT_CREATED: "Pago a repartidor registrado",
  CASH_LOAN_CREATED: "Préstamo registrado",
  CASH_LOAN_REPAYMENT_CREATED: "Abono a préstamo registrado",
  PAYROLL_PAID: "Nómina pagada",
  PAYROLL_REVERSED: "Pago de nómina reversado",
  COUPON_CREATED: "Cupón creado",
  COUPON_UPDATED: "Cupón actualizado",
  COUPON_DELETED: "Cupón eliminado",
  SETTINGS_UPDATED: "Configuración actualizada",
  CLUB_SETTINGS_UPDATED: "Configuración de Club actualizada",
  PUBLIC_HOME_SETTINGS_UPDATED: "Personalización pública actualizada",
  TRACKING_SETTINGS_UPDATED: "Configuración de métricas actualizada",
};

const ENTITY_LABELS: Record<string, string> = {
  USER: "Usuario",
  ORDER: "Pedido",
  PAYMENT: "Pago",
  PAYMENT_REFUND: "Devolución",
  CASH_REGISTER_SESSION: "Caja",
  CASH_INCOME: "Ingreso de caja",
  CASH_EXPENSE: "Salida de caja",
  CASH_LOAN: "Préstamo",
  CASH_LOAN_REPAYMENT: "Abono a préstamo",
  PAYROLL_PAYMENT: "Pago de nómina",
  COUPON: "Cupón",
  APP_SETTING: "Configuración",
  TEST_ENTITY: "Prueba técnica",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  PREPARED: "Horneando",
  READY: "Listo",
  OUT_FOR_DELIVERY: "En camino",
  ARRIVED: "Llegó",
  DELIVERED: "Entregado",
  COMPLETED: "Finalizado",
  CANCELED: "Cancelado",
  PENDING: "Pendiente",
  PAID: "Pagado",
  PARTIAL: "Parcial",
  REFUNDED: "Devuelto",
};

const VALUE_LABELS: Record<string, string> = {
  POS: "Punto de venta",
  WEB: "Página web",
  DELIVERY: "Domicilio",
  PICKUP: "Recoger en tienda",
  STORE: "En tienda",
  STAFF: "Colaborador",
  CUSTOMER: "Cliente",
  GUEST: "Invitado",
  SYSTEM: "Sistema",
  FIXED: "Valor fijo",
  PERCENTAGE: "Porcentaje",
  MANUAL: "Manual",
  COUPON: "Cupón",
  VARIABLE: "Variable",
  OPEN: "Abierto",
  CLOSED: "Cerrado",
};

const DETAIL_KEY_LABELS: Record<string, string> = {
  status: "Estado",
  deliveryTravelMode: "Modo de entrega",
  deliveredAt: "Fecha de entrega",
  driverEarningAmount: "Ganancia del repartidor",
  sequenceNumber: "Consecutivo",
  source: "Origen",
  fulfillmentType: "Tipo de pedido",
  driverId: "ID del repartidor",
  transitionOrigin: "Origen del cambio",
  orderId: "ID del pedido",
  orderSequenceNumber: "Consecutivo del pedido",
  method: "Medio de pago",
  amount: "Valor",
  cashReceived: "Efectivo recibido",
  changeDue: "Cambio",
  paidAt: "Fecha del pago",
  refundedAt: "Fecha de devolución",
  paymentId: "ID del pago",
  reason: "Motivo",
  refundableBefore: "Disponible para devolver antes",
  refundableAfter: "Disponible para devolver después",
  netReceivedBefore: "Neto recibido antes",
  netReceivedAfter: "Neto recibido después",
  paidTotalBefore: "Pagado antes",
  paidTotalAfter: "Pagado después",
  balanceAfter: "Saldo después",
  subtotal: "Subtotal",
  deliveryFee: "Domicilio",
  discount: "Descuento",
  discountSource: "Origen del descuento",
  total: "Total",
  couponId: "ID del cupón",
  couponName: "Cupón",
  eligibleSubtotal: "Base elegible",
  customerId: "ID del cliente",
  addressId: "ID de la dirección",
  scheduledFor: "Programado para",
  itemCount: "Cantidad de productos",
  openedAt: "Fecha de apertura",
  closedAt: "Fecha de cierre",
  openingBalance: "Saldo inicial",
  openingControlledBalance: "Saldo controlado inicial",
  openingLoanReceivable: "Cartera inicial",
  expectedClosingBalance: "Cierre esperado",
  actualClosingBalance: "Cierre real",
  difference: "Diferencia",
  closingCash: "Efectivo",
  closingNequi: "Nequi",
  closingDaviplata: "DaviPlata",
  closingCard: "Tarjeta",
  closingDavivienda: "Davivienda",
  netMovement: "Movimiento neto",
  loansReceivable: "Cartera por cobrar",
  category: "Categoría",
  subcategory: "Subcategoría",
  occurredAt: "Fecha",
  planningType: "Tipo de planeación",
  createdByName: "Creado por",
  workerId: "ID del trabajador",
  workerName: "Trabajador",
  principal: "Valor del préstamo",
  payrollMonth: "Mes de nómina",
  repaymentId: "ID del abono",
  loanId: "ID del préstamo",
  outstandingBefore: "Saldo antes",
  outstandingAfter: "Saldo después",
  grossAmount: "Valor bruto",
  loanDeduction: "Descuento por préstamo",
  netAmount: "Valor neto",
  shiftCount: "Cantidad de turnos",
  shiftIds: "IDs de turnos",
  affectedLoanIds: "Préstamos afectados",
  securityChanged: "Cambios de seguridad",
  passwordChanged: "Contraseña cambiada",
  active: "Activo",
  visibleInPos: "Visible en POS",
  visibleInCart: "Visible en carrito",
  name: "Nombre",
  type: "Tipo",
  value: "Valor",
  roles: "Roles",
  permissions: "Permisos",
  sessionVersion: "Versión de sesión",
  email: "Correo",
  whatsappCountryCode: "Indicativo",
  whatsappPhone: "WhatsApp",
  productId: "ID del producto",
  productName: "Producto",
  quantity: "Cantidad",
  unitPrice: "Precio unitario",
  lineTotal: "Total de línea",
  items: "Productos",
  id: "ID",
};

const SOURCE_LABELS: Record<string, string> = {
  "api/orders": "Pedidos · creación POS",
  "api/orders/[id]": "Pedidos · administración",
  "api/orders/[id]/edit": "Pedidos · edición",
  "api/orders/[id]/status": "Pedidos · cambio de estado",
  "api/orders/[id]/items/[itemId]/prepared": "Cocina · preparación",
  "api/orders/[id]/payment": "Pedidos · registro de pago",
  "api/orders/[id]/payment/[paymentId]": "Pedidos · eliminación de pago",
  "api/orders/[id]/payment/[paymentId]/refund": "Pedidos · devolución",
  "api/public-checkout": "Compra web",
  "api/repartidor/pedido/[token]/status": "Repartidor · cambio de estado",
  "api/caja/register-session": "Caja · apertura y cierre",
  "api/caja/incomes": "Caja · ingresos",
  "api/caja/incomes/[id]": "Caja · ingresos",
  "api/caja/expenses": "Caja · salidas",
  "api/caja/expenses/[id]": "Caja · salidas",
  "api/caja/loans": "Caja · préstamos",
  "api/caja/loans/[id]/repayments": "Caja · abonos",
  "api/caja/payroll": "Caja · nómina",
  "api/users": "Usuarios y roles",
  "api/users/[id]": "Usuarios y roles",
  "api/coupons": "Cupones",
  "api/coupons/[id]": "Cupones",
  "api/settings": "Configuración",
  "api/club-settings": "Club Alentó",
  "api/public-home-admin": "Personalización",
  "api/metrics/settings": "Métricas",
  vitest: "Prueba automatizada",
};

export function auditActionLabel(value: string) {
  return ACTION_LABELS[value] ?? humanizeCode(value);
}

export function auditEntityLabel(value: string) {
  return ENTITY_LABELS[value] ?? humanizeCode(value);
}

export function auditStatusLabel(value: string) {
  return STATUS_LABELS[value] ?? VALUE_LABELS[value] ?? humanizeCode(value);
}

export function auditSourceLabel(value: string | null) {
  if (!value) return "";
  return SOURCE_LABELS[value] ?? value;
}

export function auditActorTypeLabel(value: string) {
  return VALUE_LABELS[value] ?? humanizeCode(value);
}

export function auditSummaryLabel(value: string | null, fallbackAction?: string) {
  const base = value || (fallbackAction ? auditActionLabel(fallbackAction) : "");
  return Object.entries(STATUS_LABELS).reduce(
    (summary, [code, translated]) =>
      summary.replace(new RegExp(`\\b${code}\\b`, "g"), translated),
    base,
  );
}

export function auditDetailForDisplay(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => auditDetailForDisplay(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        DETAIL_KEY_LABELS[key] ?? humanizeCode(key),
        auditDetailForDisplay(item),
      ]),
    );
  }

  if (typeof value === "string") {
    return STATUS_LABELS[value] ?? VALUE_LABELS[value] ?? value;
  }

  return value;
}

function humanizeCode(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
