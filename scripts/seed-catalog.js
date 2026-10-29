const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const categories = [
  { name: 'Destacados', slug: 'destacados', imageUrl: 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/4LHlWUI05VIRbXGU9lBd.png', sortOrder: 2, visibleInPos: true },
  { name: 'Pizzas', slug: 'pizzas', imageUrl: 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/yYWPb1D1U2QebI3c3STQ.png', sortOrder: 1, visibleInPos: true },
  { name: 'Antojos', slug: 'antojos', imageUrl: 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/NsNqBWMz5c6SpmEL3UtG.png', sortOrder: 3, visibleInPos: true },
  { name: 'Bebidas', slug: 'bebidas', imageUrl: 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/b4taKDKGTJmOMSY6vXNj.png', sortOrder: 4, visibleInPos: true },
  { name: 'Insumos', slug: 'insumos', imageUrl: null, sortOrder: 10, visibleInPos: false },
  { name: 'Ingredientes', slug: 'ingredientes', imageUrl: null, sortOrder: 20, visibleInPos: false },
];

const products = [
  ['Pizzas','Chicharrona','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Chicharron Carnudo y Platano Maduro.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/XwNAxF3wHmowB7ohOVSA.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/ZzJV6kskbNZ3uYvTc4L6.png',9900,'PIZZA_SINGLE',true],
  ['Pizzas','Hawaiana Clásica','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, combinada con Jamón en cuadros y Piña.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/w2QQdwUOAKjG1V2A7HeI.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/mVuGgD3RUZ8z2ZByfEKW.png',9900,'PIZZA_SINGLE',true],
  ['Pizzas','Napolitana','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, cubierta con rodajas de Tomate, Extra Queso y Orégano.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/xPQsMKy4822hKP8Ieoxl.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/VTDYpAigvRSYF6Y2DBWY.png',9900,'PIZZA_SINGLE',true],
  ['Pizzas','Pollo & Champiñón','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, cubierta con Pollo Desmechado y Champiñones.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/GwRjcMpaaKttf4cYYF0X.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/4fjUw6oEw6SQrvfQhM76.png',9900,'PIZZA_SINGLE',true],
  ['Pizzas','Fiesta Pepperoni','Masa artesanal madurada, Base De Tomate de la casa y doble porción de Queso Mozzarella, cubierta con doble porción de Pepperoni.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/F1bw3hlWspyhiCyEd1ki.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/w1dhszwStdj4n2P8kO5k.png',14900,'PIZZA_SINGLE',true],
  ['Pizzas','Tropical','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Piña, Ciruela y Cerezas.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/n8YXkep3zbSiKauR9XJW.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/RdXgw08UI9vVmGx1JbAC.png',14900,'PIZZA_SINGLE',true],
  ['Pizzas','Carnes Tradicional','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Salami, Jamón, Chorizo y Carne Desmechada.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/ZhNQDNGg0RLYFA5V1pmu.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/r6FscomJJ1d60Rbfmg3i.png',19900,'PIZZA_SINGLE',true],
  ['Pizzas','Criolla Tradicional','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Cebolla, Tocineta, Chorizo y Maíz Tierno.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/w9tmeo78q8sTdwfOHntr.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/PC9C1EkhEKcJj3ZCkcqb.png',19900,'PIZZA_SINGLE',true],
  ['Pizzas','Hawaiana Chick','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Tocineta, Pollo Desmechado, Piña y Salsa BBQ.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/ugEfyX9FlaQnXc0eo00C.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/wD4vSN9BINup46C2ouxJ.png',19900,'PIZZA_SINGLE',true],
  ['Pizzas','La Paisa','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Chicharron Carnudo, Chorizo, Frijol Y Platano Maduro.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/qJZQ8Lnd10Fy9PKMIWgS.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/Wtc4ygXjD3gOxeLyuwQ1.png',19900,'PIZZA_SINGLE',true],
  ['Pizzas','Vegetariana','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Rodajas De Tomate, Champiñones, Cebolla y Pimentón.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/y9XjoyKj36RLVujqjmp0.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/qVQmnJF4x4fc5eWqrsLV.png',19900,'PIZZA_SINGLE',true],
  ['Pizzas','Mexicana Especial','Masa artesanal madurada, Base De Tomate de la casa y Queso Mozzarella, Salami, Chorizo, Maíz Tierno, Cebolla y Jalapeño.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/z8XInxzpye95lU4wB0dI.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/yzQyVJIzpCVkxX2wb2J6.png',24900,'PIZZA_SINGLE',true],
  ['Antojos','Canelones','16 Panecillos Recién Horneados, Espolvoreados Con Canela Y Acompañados De Arequipe Alpina.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/E50ko8lGL3C5LpGuMxEc.png',null,14900,'STANDARD',true],
  ['Antojos','Palitos Con Queso','8 Palitos De Queso Recién Horneados Al Momento Acompañados Con 2 Sobres De Chocolate Muuu.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/eRV7RpB22UxEH4F2W1oI.png',null,14900,'STANDARD',true],
  ['Bebidas','Coca Cola 1.5LT','La Gaseosa Coca-Cola Original, para refrescarte con su inconfundible sabor original, para que la disfrutes bien fría.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/1IAJFCtasT2sG9EUVID1.png',null,7900,'STANDARD',true],
  ['Bebidas','Ginger 1.5LT','Mezclador Schweppes Ginger Ale 1.5 L, mezclador Schweppes con su sabor a ginger ale.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/HONHqLSyPeEaJe8iVQzh.png',null,7900,'STANDARD',true],
  ['Bebidas','Quatro Toronja 1.5LT','Gaseosa Quatro Original, elaborado con jugo de toronja.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/ffUKklneJ4jltF0WsCTd.png',null,7900,'STANDARD',true],
  ['Bebidas','Kola Román 1.5LT','Gaseosa Kola Roman Original.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/tWzyTSFbiNtmJ8JCRsZU.webp',null,7900,'STANDARD',true],
  ['Bebidas','Sprite 1.5LT','Burbujeante, refrescante y de sabor ligero.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/IhwQPYCzQ9Mltkm2gmq3.png',null,7900,'STANDARD',true],
  ['Destacados','Combo Antojo','Incluye 8 Palitos con Queso recién horneados, 1 gaseosa 1.5 L y 2 sobres de chocolate Muuu.','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/M9HBoPF486x9Ul1Uhleg.png',null,19900,'COMBO',true],
  ['Pizzas','Pizza 2 Sabores',null,'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/iQVFO6slU0718hpauWNK.png','https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/tuAuDcg4tDjqHB6KDZKL.png',null,'PIZZA_TWO_FLAVORS',true],
  ['Bebidas','Coca Cola 400ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Quatro Toronja 400ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Sprite 400ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Kola Román 400ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Coca Cola Lata 330ML',null,null,null,4900,'STANDARD',true],
  ['Bebidas','Coca Cola Zero Lata 330ML',null,null,null,4900,'STANDARD',true],
  ['Bebidas','Monster Green 473ML',null,null,null,9900,'STANDARD',true],
  ['Bebidas','Monster Ultra Paradise 473ML',null,null,null,9900,'STANDARD',true],
  ['Bebidas','Monster Mango Loco 473ML',null,null,null,9900,'STANDARD',true],
  ['Bebidas','Monster Pipeline Punch 473ML',null,null,null,9900,'STANDARD',true],
  ['Bebidas','Agua Con Gas Maracuyá 600ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Agua Con Gas Limón 600ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Agua Con Gas Manzana 600ML',null,null,null,3500,'STANDARD',true],
  ['Insumos','Caja De Pizza 20*20',null,null,null,null,'INTERNAL',false],
  ['Insumos','Caja De Pizza 27*27',null,null,null,null,'INTERNAL',false],
  ['Insumos','Caja De Pizza 36*36',null,null,null,null,'INTERNAL',false],
  ['Insumos','Caja De Pizza 41*41',null,null,null,null,'INTERNAL',false],
  ['Ingredientes','Queso Mozzarella',null,'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/4kaJyLxshz9T21Sb70hk.webp',null,5000,'MODIFIER',false],
  ['Ingredientes','Queso Cheddar',null,null,null,5000,'MODIFIER',false],
  ['Insumos','Masa 20CM',null,null,null,null,'INTERNAL',false],
  ['Insumos','Masa 27CM',null,null,null,null,'INTERNAL',false],
  ['Insumos','Masa 36CM',null,null,null,null,'INTERNAL',false],
  ['Insumos','Masa 41CM',null,null,null,null,'INTERNAL',false],
  ['Bebidas','Ginger 400ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Agua Con Gas Maracuyá 1.5LT',null,null,null,7900,'STANDARD',true],
  ['Bebidas','Jugo Del Valle Naranja 1.5LT',null,null,null,7900,'STANDARD',true],
  ['Bebidas','Jugo Del Valle Naranja 400ML',null,null,null,3500,'STANDARD',true],
  ['Bebidas','Agua Sin Gas 600ML',null,null,null,3500,'STANDARD',true],
  ['Ingredientes','Pepperoni',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Chorizo',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Jamón',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Tocineta',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Chicharrón Carnudo',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Plátano Maduro',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Piña',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Champiñón',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Pollo Desmechado',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Carne Desmechada',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Cerezas',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Ciruelas',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Salami',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Cebolla',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Maíz Tierno',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Frijoles',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Tomate',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Pimentón',null,null,null,5000,'MODIFIER',false],
  ['Ingredientes','Jalapeño',null,null,null,5000,'MODIFIER',false],
];

const sizes = [
  { name: 'Personal', diameterCm: 20, basePrice: 5000, sortOrder: 1 },
  { name: 'Mediana', diameterCm: 27, basePrice: 15000, sortOrder: 2 },
  { name: 'Grande', diameterCm: 36, basePrice: 30000, sortOrder: 3 },
  { name: 'Extra', diameterCm: 41, basePrice: 45000, sortOrder: 4 },
];

const crusts = [
  { name: 'Tradicional', prices: { Personal: 0, Mediana: 0, Grande: 0, Extra: 0 } },
  { name: 'Bocadillo', prices: { Personal: 3900, Mediana: 5900, Grande: 6900, Extra: 7900 } },
  { name: 'Mozzarella', prices: { Personal: 3900, Mediana: 5900, Grande: 7900, Extra: 9900 } },
  { name: 'Cheddar', prices: { Personal: 6900, Mediana: 8900, Grande: 10900, Extra: 12900 } },
  { name: 'SalchiBorder', prices: { Personal: 8900, Mediana: 10900, Grande: 12900, Extra: 14900 } },
];

async function main() {
  const categoryMap = new Map();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
    categoryMap.set(category.name, saved);
  }

  for (let i = 0; i < products.length; i += 1) {
    const [categoryName, name, description, imageUrl, imageUrl2, basePrice, type, visibleInPos] = products[i];
    const category = categoryMap.get(categoryName);
    const data = {
      categoryId: category.id,
      name,
      description,
      imageUrl,
      imageUrl2,
      basePrice,
      type,
      visibleInPos,
      active: true,
      featured: categoryName === 'Destacados',
      sortOrder: i,
    };
    await prisma.product.upsert({
      where: { categoryId_name: { categoryId: category.id, name } },
      update: data,
      create: data,
    });
  }

  const sizeMap = new Map();
  for (const size of sizes) {
    const saved = await prisma.pizzaSize.upsert({
      where: { name: size.name },
      update: size,
      create: size,
    });
    sizeMap.set(size.name, saved);
  }

  for (let i = 0; i < crusts.length; i += 1) {
    const crustData = crusts[i];
    const crust = await prisma.pizzaCrust.upsert({
      where: { name: crustData.name },
      update: { active: true, sortOrder: i },
      create: { name: crustData.name, active: true, sortOrder: i },
    });

    for (const [sizeName, price] of Object.entries(crustData.prices)) {
      const size = sizeMap.get(sizeName);
      await prisma.pizzaCrustPrice.upsert({
        where: { crustId_sizeId: { crustId: crust.id, sizeId: size.id } },
        update: { price },
        create: { crustId: crust.id, sizeId: size.id, price },
      });
    }
  }

  console.log('Catálogo Alentó cargado correctamente.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
