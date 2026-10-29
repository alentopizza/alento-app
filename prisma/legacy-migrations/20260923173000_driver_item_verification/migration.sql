ALTER TABLE "OrderItem"
ADD COLUMN IF NOT EXISTS "driverVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "driverVerifiedDriverId" INTEGER;

-- La verificación pertenece al repartidor asignado en ese momento.
-- Si el pedido se reasigna, los checks del driver anterior permanecen como
-- historial técnico pero no cuentan para el nuevo repartidor.
