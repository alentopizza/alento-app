export type CashExpenseCategory = {
  name: string;
  subcategories: string[];
};

export const CASH_EXPENSE_CATEGORIES: CashExpenseCategory[] = [
  {
    name: "Maquinaria",
    subcategories: ["Amasadora", "Procesadora", "Nevera Everest", "Nevera Freezer"],
  },
  {
    name: "Insumos",
    subcategories: [
      "Aceite De Oliva",
      "Ajo En Polvo",
      "Carne Desmechada",
      "Champiñon",
      "Chorizo Santarrosano",
      "Harina De Trigo",
      "Jalapeño",
      "Jamon",
      "Levadura Seca Activa",
      "Maiz Tierno",
      "Oregano En Polvo",
      "Pepperoni",
      "Pimenton",
      "Piña",
      "Pollo",
      "Queso Mozzarella",
      "Salami",
      "Tocineta Ahumada",
      "Pasta De Tomate",
      "Tomate",
      "Cebolla",
      "Quatro 400ML",
      "Sprite 400ML",
      "Coca-Cola 400ML",
      "Quatro 1,5LT",
      "Sprite 1,5LT",
      "Coca-Cola 1,5LT",
      "Caja 20*20",
      "Caja 27*27",
      "Caja 36*36",
      "Caja 41*41",
      "Kola Román 400ML",
      "Kola Román 1.5LT",
      "Ginger 1.5LT",
      "Coca Cola Lata 330ML",
      "Coca Cola Zero Lata 330ML",
      "Monster Green 473ML",
      "Monster Ultra Paradise 473ML",
      "Monster Mango Loco 473ML",
      "Monster Pipeline Punch 473ML",
      "Papada",
      "Queso Chédar",
      "Salchicha Zenú x3",
      "Arequipe Alpina",
      "Muuu...",
      "Sal",
      "Azucar",
      "Oregano",
      "Ajo",
      "Especies",
      "Bocadillo",
      "Agua Con Gas Maracuyá 600ML",
      "Harina Amarilla",
      "Plátano Maduro",
      "Aceite",
      "Lata Frijol",
    ],
  },
  { name: "Nomina", subcategories: [] },
  { name: "Domicilios", subcategories: [] },
  {
    name: "Servicios Públicos",
    subcategories: ["Luz", "Gas", "Agua"],
  },
  {
    name: "Plataformas",
    subcategories: ["Make", "Chat GPT", "Glide"],
  },
  { name: "Parqueadero", subcategories: [] },
  { name: "Otros", subcategories: [] },
  { name: "Arriendo", subcategories: [] },
  {
    name: "Publicidad",
    subcategories: [
      "Sticker Factura",
      "Sticker De Seguridad",
      "Volantes",
      "Imanes",
      "Impresiones",
      "Facebook Ads",
      "WhatsApp Api",
    ],
  },
  { name: "Consumo Interno", subcategories: [] },
];

export const CASH_EXPENSE_CATEGORY_NAMES = CASH_EXPENSE_CATEGORIES.map(
  (item) => item.name,
);

export function cashExpenseSubcategories(category: string) {
  return (
    CASH_EXPENSE_CATEGORIES.find((item) => item.name === category)
      ?.subcategories ?? []
  );
}
