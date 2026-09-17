ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

-- El POS históricamente crea la orden como CONFIRMED. Desde este flujo operativo,
-- toda nueva orden confirmada debe entrar inmediatamente a Cocina en PREPARING.
CREATE OR REPLACE FUNCTION alento_order_start_preparing()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'CONFIRMED' THEN
    NEW."status" := 'PREPARING';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alento_order_start_preparing_trigger ON "Order";
CREATE TRIGGER alento_order_start_preparing_trigger
BEFORE INSERT ON "Order"
FOR EACH ROW
EXECUTE FUNCTION alento_order_start_preparing();
