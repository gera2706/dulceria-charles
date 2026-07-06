const PRODUCTS = [

  // ── BOMBONES ──
  { id: 1,  name: 'Bianchi Corazón 400gr',         category: 'bombones',   price: 53,  image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BIANCHI CORAZON 400gr $53.webp',                                        featured: false },
  { id: 2,  name: 'Bombon Mediano Colores 400gr',   category: 'bombones',   price: 43,  image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BOMBOM MEDIANO COLORES 400gr $43.webp',                                  featured: false },
  { id: 3,  name: 'Bombon Mini Blanco 400gr',       category: 'bombones',   price: 48,  image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BOMBOM MINI BLANCO 400gr $48.webp',                                      featured: false },
  { id: 4,  name: 'Bombón de Chocolate 50pz',       category: 'bombones',   price: 120, image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BOMBON DE CHOCOLATE 50pz $120.webp',                                     featured: true  },
  { id: 5,  name: 'Malv Corazón Choc 50pz',         category: 'bombones',   price: 120, image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR MALV CORAZON CHOC 50pz $120.webp',                                       featured: false },
  { id: 6,  name: 'Malvavisco Malvabón 12pz',       category: 'bombones',   price: 75,  image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR MALVAVISCO MALVABON 12pz $75.webp',                                      featured: false },
  { id: 7,  name: 'Ositos Conejos Pollitos 400gr',  category: 'bombones',   price: 43,  image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR OSITOS CONEJOS POLLITOS 400gr $43.webp',                                 featured: true  },
  { id: 8,  name: 'Paleta Malvabony 40pz',          category: 'bombones',   price: 85,  image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR PAL MALVABONY 40pz $85.webp',                                           featured: false },
  { id: 9,  name: 'Paleta Payaso Ricolino 10pz',    category: 'bombones',   price: 120, image: 'img/productos/Bombones-20260528T212319Z-3-001/Bombones/Paleta Payaso de Ricolino  Caja 10 pzas $120.webp',                          featured: true  },

  // ── BOTANAS ──
  { id: 10, name: 'Barcel Combotanas 25pz',         category: 'botanas',    price: 270, image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/BARCEL COMBOTANAS 25pz $270.webp',                                            featured: true  },
  { id: 11, name: 'Chechitos Donitas Chile 25pz',   category: 'botanas',    price: 43,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Donitas Chile Intenso Bolsa Chica 25 pzas 150 g $43.webp',           featured: false },
  { id: 12, name: 'Chechitos Kikys Ahumados 24pz',  category: 'botanas',    price: 65,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Ahumados  Bolsa Mega 24 pzas 480 g $65.webp',                 featured: false },
  { id: 13, name: 'Kikys Chile Intenso Chica 25pz', category: 'botanas',    price: 43,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Chile Intenso  Bolsa Chica 25 pzas 275 g $43.webp',           featured: false },
  { id: 14, name: 'Kikys Chile Intenso Mega 24pz',  category: 'botanas',    price: 65,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Chile Intenso  Bolsa Mega 24 pzas 480 g $65.webp',            featured: false },
  { id: 15, name: 'Kikys Queso y Chile 25pz',       category: 'botanas',    price: 43,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Queso y Chile  Bolsa Chica 25 pzas 275 g $43.webp',           featured: false },
  { id: 16, name: 'Kikys Queso y Jalapeño 25pz',    category: 'botanas',    price: 43,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Queso y Jalapeño  Bolsa Chica 25 pzas 275 g $43.webp',        featured: false },
  { id: 17, name: 'Frituras Chile y Limón 5pz',     category: 'botanas',    price: 75,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Frituras sabor Chile y Limón - Chidas Bolsa 5 pzas $75.webp',                 featured: false },
  { id: 18, name: 'Papas Chidas con Sal 5pz',       category: 'botanas',    price: 95,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Papas Chidas con Sal  Paquete 5 bolsas $95.webp',                             featured: true  },
  { id: 19, name: 'Papas Chidas Limón 5pz',         category: 'botanas',    price: 75,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Papas Chidas Limón  Paquete 5 bolsas $75.webp',                               featured: false },
  { id: 20, name: 'Papas Chidas Salsa Negra 5pz',   category: 'botanas',    price: 100, image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Papas Chidas Salsa Negra  Paquete 5 bolsas $100.webp',                        featured: false },
  { id: 21, name: 'Re-Mix Explosión Frituras 10pz', category: 'botanas',    price: 70,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Re-Mix Explosion de Frituras - Queso, cebolla y Chile  Bolsa 10 pzas $70.webp',featured: false },
  { id: 22, name: 'Sabritas Fritos Sal 10pz',       category: 'botanas',    price: 75,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SABRITAS FRITOS SAL TPACK 10pz $75.webp',                                     featured: false },
  { id: 23, name: 'Sabritas Fritura Minis 50pz',    category: 'botanas',    price: 320, image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SABRITAS FRITURA MINIS 963gr 50pz $320.webp',                                 featured: true  },
  { id: 24, name: 'Sabritas Rancheritos 10pz',      category: 'botanas',    price: 75,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SABRITAS RANCHERITOS TPACK 10pz $75.webp',                                    featured: false },
  { id: 25, name: 'Cacahuate Crujiente 700g',       category: 'botanas',    price: 75,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE CRUJIENTE 700grs $75.webp',                                     featured: false },
  { id: 26, name: 'Cacahuate Enchilado 1kg',        category: 'botanas',    price: 100, image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE ENCHILADO 1K $100.webp',                                        featured: false },
  { id: 27, name: 'Cacahuate Japonés 1kg',          category: 'botanas',    price: 90,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE JAPONES 1K $90.webp',                                           featured: false },
  { id: 28, name: 'Cacahuate Salado 1kg',           category: 'botanas',    price: 75,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE SALADO 1K $75.webp',                                            featured: false },
  { id: 29, name: 'Totopos Salsa Negra 10pz',       category: 'botanas',    price: 55,  image: 'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Totopos sabor Salsa Negra Bolsa 10 pzas $55.webp',                            featured: false },

  // ── CHOCOLATES ──
  { id: 30, name: 'Bremen Flops 500gr',             category: 'chocolates', price: 100, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/BREMEN FLOPS CHICO 500gr $100.webp',                                    featured: false },
  { id: 31, name: 'Bremen Galleta Fass 500gr',      category: 'chocolates', price: 150, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/BREMEN GALLETA FASS 500gr $150.webp',                                   featured: false },
  { id: 32, name: 'Kinder Delice 10pz',             category: 'chocolates', price: 135, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/Chocolate Kinder Delice 10 pz $135.webp',                               featured: true  },
  { id: 33, name: 'Winky Nougat De La Rosa 10pz',   category: 'chocolates', price: 120, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/Chocolates Winky Nougat De La Rosa  Caja 10 pzas 560 g $120.webp',      featured: false },
  { id: 34, name: 'Chocoretas Clásicas 500g',       category: 'chocolates', price: 130, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/Chocoretas Clásicas de Ricolino  Bolsa 500 g $130.webp',                featured: false },
  { id: 35, name: 'Choco Nugs Recreo 10pz',         category: 'chocolates', price: 120, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR CHOCO NUGS RECREO 10pz $120.webp',                                  featured: false },
  { id: 36, name: 'Chocolate Coconugs 12pz',        category: 'chocolates', price: 75,  image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR CHOCOLATE COCONUGS 12pz $75.webp',                                  featured: false },
  { id: 37, name: 'Chocolate Suizo 16pz',           category: 'chocolates', price: 135, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR CHOCOLATE SUIZO 16pz $135.webp',                                    featured: true  },
  { id: 38, name: 'Mazapán Chocolate 16pz',         category: 'chocolates', price: 45,  image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR MAZAPAN CCHOCOLATE 16pz $45.webp',                                  featured: false },
  { id: 39, name: 'Milky Way Six Pack 6pz',         category: 'chocolates', price: 120, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/EFFEM MILKY WAY SIX PACK 6pzs $120.webp',                               featured: false },
  { id: 40, name: 'Snickers Almendra 6pz',          category: 'chocolates', price: 120, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/EFFEM SNIKERS ALMENDRA 43.4GRS 6pzs $120.webp',                         featured: false },
  { id: 41, name: 'Snickers Six Pack 6pz',          category: 'chocolates', price: 120, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/EFFEM SNIKERS SIX PACK 6pzs $120.webp',                                 featured: true  },
  { id: 42, name: 'Ferrero Raffaello 8pz',          category: 'chocolates', price: 90,  image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/FERRERO RAFAELLO BL T8 8pz $90.webp',                                   featured: false },
  { id: 43, name: 'Ferrero Rocher 24pz',            category: 'chocolates', price: 280, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/FERRERO ROCHER T24 24pz $280.webp',                                     featured: true  },
  { id: 44, name: 'Ferrero Rocher 8pz',             category: 'chocolates', price: 95,  image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/FERRERO ROCHER T8 8pz $95.webp',                                        featured: false },
  { id: 45, name: 'Hersheys Kisses 1kg',            category: 'chocolates', price: 280, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/HSY KISSES BULK 1K $280.webp',                                          featured: false },
  { id: 46, name: 'Duvalin Trisabor 18pz',          category: 'chocolates', price: 50,  image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/JOYCO DUVALIN TRISABOR 18pz $50.webp',                                  featured: false },
  { id: 47, name: 'La Corona Huevito 1kg',          category: 'chocolates', price: 140, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/LA CORONA HUEVITO 1K $140.webp',                                        featured: false },
  { id: 48, name: 'Nestle Carlos V Suizo 16pz',     category: 'chocolates', price: 140, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/NESTLE CARLOS V SUIZO 16pz $140.webp',                                  featured: false },
  { id: 49, name: 'Nestle KitKat 9pz',              category: 'chocolates', price: 180, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/NESTLE KITKAT 41.5gr 9pz $180.webp',                                    featured: false },
  { id: 50, name: 'Cremino Bicolor 24pz',           category: 'chocolates', price: 80,  image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/NUTRESA CREMINO BICOLOR 24pz $80.webp',                                 featured: false },
  { id: 51, name: 'Ricolino Bubulubu 12pz',         category: 'chocolates', price: 140, image: 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/RICOLINO BUBULUBU 12pz $140.webp',                                      featured: false },

  // ── ENCHILADOS ──
  { id: 52, name: 'Pelón Pelórico 12pz',            category: 'enchilados', price: 90,  image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/HSY PELON PELORICO 12pz $90.webp',                                      featured: true  },
  { id: 53, name: 'Peloneta Chamoy 10pz',           category: 'enchilados', price: 55,  image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/HSY PELONETA PUESTO CHAMOY 10pz $55.webp',                              featured: false },
  { id: 54, name: 'Pelonetes 6pz',                  category: 'enchilados', price: 55,  image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/HSY PELONETES 6pz $55.webp',                                            featured: false },
  { id: 55, name: 'Lucas Gusano Chamoy 10pz',       category: 'enchilados', price: 90,  image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS GUSANO DE CHAMOY 10pzs $90.webp',                                 featured: false },
  { id: 56, name: 'Lucas Muecas Chamoy 10pz',       category: 'enchilados', price: 95,  image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS MUECAS CHAMOY 10pzs $95.webp',                                    featured: true  },
  { id: 57, name: 'Lucas Muecas Pepino 10pz',       category: 'enchilados', price: 95,  image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS MUECAS PEPINO 10pzs $95.webp',                                    featured: false },
  { id: 58, name: 'Lucas Panzón Sandcham 10pz',     category: 'enchilados', price: 100, image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS PANZON SANDCHAM 10pzs $100.webp',                                 featured: false },
  { id: 59, name: 'Lucas Salsaghetti 12pz',         category: 'enchilados', price: 110, image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS SALSAGHETTI SANTAM 12pzs $110.webp',                              featured: true  },
  { id: 60, name: 'Pulparindo Gigante 16pz',        category: 'enchilados', price: 100, image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/Pulparindo Gigante Extra Picante  De La Rosa  Caja 16 pzas 448 g $100.webp', featured: false },
  { id: 61, name: 'Pulparindots 20pz',              category: 'enchilados', price: 115, image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/Pulparindots De La Rosa  Caja 20 pzas 600 g $115.webp',                 featured: false },
  { id: 62, name: 'Vero Picagoma Fresa 100pz',      category: 'enchilados', price: 84,  image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/VERO PICAGOMA FRESA 100pzs $84.webp',                                   featured: false },
  { id: 63, name: 'Vero Picagoma Fresa Grande 60pz',category: 'enchilados', price: 105, image: 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/VERO PICAGOMA FRESA GNTE 60pzs $105.webp',                              featured: false },

  // ── GOMITAS ──
  { id: 64, name: 'Gomilocas Pingüinos 1kg',        category: 'gomitas',    price: 145, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomilocas Pingüinos 1 kg $ 145 .webp',                                        featured: true  },
  { id: 65, name: 'Aros de Durazno 1kg',            category: 'gomitas',    price: 100, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Aros de Durazno - Lucky Gummy  Bolsa 1 kg $100.webp',                 featured: false },
  { id: 66, name: 'Aros de Manzana 1kg',            category: 'gomitas',    price: 105, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Aros de Manzana - Lucky Gummy  Bolsa 1 kg $105.webp',                 featured: false },
  { id: 67, name: 'Ositos Icee Canels 454g',        category: 'gomitas',    price: 65,  image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Canel_s Ositos Icee  Bolsa 454 g $65.webp',                           featured: false },
  { id: 68, name: 'Gomitas Corazones 1kg',          category: 'gomitas',    price: 100, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Corazones - Lucky Gummy  Bolsa 1 kg $100.webp',                       featured: false },
  { id: 69, name: 'Mangusanos Enchilados 1kg',      category: 'gomitas',    price: 95,  image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Enchiladas Mangusanos - Lucky Gummy  Bolsa 1 kg $ 95.webp',           featured: false },
  { id: 70, name: 'Frutas del Bosque 500g',         category: 'gomitas',    price: 79,  image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Frutas del Bosque  De La Rosa  Bolsa 500 g $78.77.webp',              featured: false },
  { id: 71, name: 'Frutas Surtidas 1kg',            category: 'gomitas',    price: 125, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Frutas Sabores Surtidos 1 kg $125.webp',                              featured: true  },
  { id: 72, name: 'Gotitas Lucky Gummy 1kg',        category: 'gomitas',    price: 105, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Gotitas - Lucky Gummy  Bolsa 1 kg $105.webp',                         featured: false },
  { id: 73, name: 'Lombrices Lucky Gummy 1kg',      category: 'gomitas',    price: 105, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Lombrices - Lucky Gummy  Bolsa 1 kg $105.webp',                       featured: false },
  { id: 74, name: 'Lombriz Neón 1kg',               category: 'gomitas',    price: 105, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Lombriz Neón - Lucky Gummy  Bolsa 1 kg $105.webp',                    featured: false },
  { id: 75, name: 'Orugas Lucky Gummy 1kg',         category: 'gomitas',    price: 105, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Orugas - Lucky Gummy  Bolsa 1 kg $ 105.webp',                         featured: false },
  { id: 76, name: 'Ositos Clásicos 1kg',            category: 'gomitas',    price: 105, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Ositos clásicos - Lucky Gummy  Bolsa 1 kg $105.webp',                 featured: false },
  { id: 77, name: 'Panditas Clásicos Ricolino 1kg', category: 'gomitas',    price: 145, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Panditas Clásicos Ricolino  Bolsa 1 kg $ 145.webp',                   featured: true  },
  { id: 78, name: 'Tiburones Lucky Gummy 1kg',      category: 'gomitas',    price: 105, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Tiburones - Lucky Gummy  Bolsa 1 kg $105.webp',                       featured: false },
  { id: 79, name: 'Tiburones Crazy Gummy 1kg',      category: 'gomitas',    price: 130, image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Tiburones Crazy Gummy Sabores Surtidos 1 kg $130.webp',               featured: false },
  { id: 80, name: 'Mini Jelly Huevito 20pz',        category: 'gomitas',    price: 60,  image: 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/HUBIN MINI JELLY HUEVITO 20pzs $60.webp',                                     featured: false },

  // ── MAZAPANES ──
  { id: 81, name: 'Mazapán Chico 60pz',             category: 'mazapanes',  price: 100, image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN CHICO 60pz $100.webp',                                       featured: true  },
  { id: 82, name: 'Mazapán Chocolate 16pz',         category: 'mazapanes',  price: 80,  image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN CHOCOLATE 16pz $80.webp',                                    featured: false },
  { id: 83, name: 'Mazapán en Polvo 908gr',         category: 'mazapanes',  price: 120, image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN EN POLVO 908gr $120.webp',                                   featured: false },
  { id: 84, name: 'Mazapán Gigante 20pz',           category: 'mazapanes',  price: 120, image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN GIGANTE 20pz $120.webp',                                     featured: true  },
  { id: 85, name: 'Mazapán Gigante Choc 12pz',      category: 'mazapanes',  price: 145, image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN GTE CHOC 12pz $145.webp',                                    featured: false },
  { id: 86, name: 'Mazapán Original 12pz',          category: 'mazapanes',  price: 50,  image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN ORIG 12pz $ 50.webp',                                        featured: false },
  { id: 87, name: 'Mazapán Original 30pz',          category: 'mazapanes',  price: 110, image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN ORIG 30pz $110.webp',                                        featured: false },
  { id: 88, name: 'Montes Mazapán 30pz',            category: 'mazapanes',  price: 90,  image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/MONTES MAZAPÁN 30pz $90.webp',                                           featured: false },
  { id: 89, name: 'Nestlé Crunch Mazapán 15pz',     category: 'mazapanes',  price: 75,  image: 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/NESTLE CRUNCH MAZAPAN 15pz $75.webp',                                    featured: true  },

  // ── PALETAS ──
  { id: 90, name: 'Coronado Paletón 10pz',          category: 'paletas',    price: 25,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/CORONADO PALETON 10pz $25.webp',                                              featured: false },
  { id: 91, name: 'Paleta Maxi Jumbo 150pz',        category: 'paletas',    price: 115, image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/DLR PAL.MAXI JUMBO 150pzs $115.webp',                                        featured: true  },
  { id: 92, name: 'Peloneta Chamoy Sandía 18pz',    category: 'paletas',    price: 103, image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/HYS PELONETA CHAMSAN 18pz $103.webp',                                        featured: false },
  { id: 93, name: 'Peloneta Tamarindo Mango 18pz',  category: 'paletas',    price: 103, image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/HYS PELONETA TAMMGO 18pz $103.webp',                                         featured: false },
  { id: 94, name: 'Calaveritas Neón 24pz',          category: 'paletas',    price: 81,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paleta Calaveritas Neón 24 piezas Display $81.webp',                          featured: false },
  { id: 95, name: 'Chupa Chups Chocolate 40pz',     category: 'paletas',    price: 122, image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Chupa-Chups Chocolate  Bolsa 40 pzas 480 g $122.webp',               featured: true  },
  { id: 96, name: 'Chupa Chups Cremosas 40pz',      category: 'paletas',    price: 122, image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Chupa-Chups Cremosas  Bolsa 40 pzas 480 g $122.webp',                featured: false },
  { id: 97, name: 'Escobón Sandía Chile 40pz',      category: 'paletas',    price: 55,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Escobón sandía con Chile  Bolsa 40 pzas 320 g $55.webp',              featured: false },
  { id: 98, name: 'Rockaleta Junior 20pz',          category: 'paletas',    price: 87,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Rockaleta Junior  Bolsa 20 pzas 250 g $87.webp',                      featured: false },
  { id: 99, name: 'Tropimango Chile 40pz',          category: 'paletas',    price: 87,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas sabor Mango con Chile - Tropimango  Bolsa 40 pzas 560 g $87.webp',    featured: true  },
  { id:100, name: 'Piña Caribeña Chile 40pz',       category: 'paletas',    price: 88,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas saborpiña con Chile -piña Caribeña  Bolsa 40 pzas 560 g $88.webp',    featured: false },
  { id:101, name: 'Sonrics Tixtix 30pz',            category: 'paletas',    price: 75,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/SONRIC_S PALETA TIXTIX 30pz $75.webp',                                        featured: false },
  { id:102, name: 'Vero Paleta Elote 40pz',         category: 'paletas',    price: 92,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL ELOTE 40pz  $92.webp',                                               featured: false },
  { id:103, name: 'Vero Paleta Manita 40pz',        category: 'paletas',    price: 92,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL MANITA 40pz $92.webp',                                               featured: false },
  { id:104, name: 'Vero Pintazul 10pz',             category: 'paletas',    price: 65,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL MARBETE PINTAZUL 10pz $65.webp',                                     featured: false },
  { id:105, name: 'Vero Semaforito 40pz',           category: 'paletas',    price: 92,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL SEMAFORITO 40pz $92.webp',                                           featured: false },
  { id:106, name: 'Vero Bomba Negra 40pz',          category: 'paletas',    price: 82,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL.BOMBA NEGRA 40pzs $82.webp',                                         featured: false },
  { id:107, name: 'Vero Brochita Pintazul 48pz',    category: 'paletas',    price: 92,  image: 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL.BROCHITA PINTAZUL 48pzs $92.webp',                                   featured: true  },
];

/* ───── Caché de productos cargados desde la API ───── */
var DC_PRODUCTS_CACHE = [];

/*
  getAllProducts() → devuelve el caché (o PRODUCTS estático como fallback)
  loadProducts()  → async, carga desde la API y actualiza el caché
*/
function getAllProducts() {
  return DC_PRODUCTS_CACHE.length ? DC_PRODUCTS_CACHE : PRODUCTS;
}

async function loadProducts(filtros) {
  try {
    var products = await apiGetProductos(filtros || {});
    /* Normalizar campo 'name' para compatibilidad con el frontend existente */
    products = products.map(function(p) {
      return Object.assign({}, p, { name: p.nombre, price: parseFloat(p.precio), category: p.categoria });
    });
    DC_PRODUCTS_CACHE = products;
    return products;
  } catch (e) {
    console.warn('API no disponible, usando productos estáticos:', e.message);
    DC_PRODUCTS_CACHE = PRODUCTS;
    return PRODUCTS;
  }
}

