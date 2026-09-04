/* ============================================================================
   data.js — Catálogo público de centros con intercambio aprobado 2026/2027
   ----------------------------------------------------------------------------
   Estos datos son PÚBLICOS (proceden de las resoluciones publicadas en el
   BOCYL) y NO se editan desde la ficha ni se guardan en Firestore: viven aquí,
   en el propio código. Para añadir/corregir un centro (p.ej. al empezar un
   curso nuevo), edita este archivo y vuelve a subirlo a GitHub.

   Fuentes:
   - Orden EDU/571/2026, de 12 de junio (BOCYL n.º 116, 18/06/2026) — públicos.
   - Orden EDU/604/2026, de 30 de junio (BOCYL n.º 127, 03/07/2026) — concertados.
   - Teléfono de cada centro: listadoCentrosSecundaria.csv (directorio de
     centros de la Consejería de Educación), cruzado por código de centro;
     el de Colegio SAGRADO CORAZÓN (León) lo confirmó el equipo a mano, ya
     que no encajaba con ningún código de ese csv.
   ============================================================================ */

var PUBLICOS = [
  {n:"IES FRANCISCO GINER DE LOS RÍOS", c:"40003708", tel:"921423512", p:"Segovia", pt:14.8, im:5000, d:[["Estados Unidos",7],["Noruega",2]]},
  {n:"IES MARÍA MOLINER", c:"40003666", tel:"921427011", p:"Segovia", pt:13.6, im:4900, d:[["Alemania",10],["Francia",2],["Canadá",2]]},
  {n:"IES VENANCIO BLANCO", c:"37009131", tel:"923183441", p:"Salamanca", pt:13.3, im:3000, d:[["Francia",10]]},
  {n:"IES VILLA DEL MONCAYO", c:"42004029", tel:"976192314", p:"Soria", pt:13, im:4150, d:[["Canadá",5],["Francia",3]]},
  {n:"IES ANTONIO TOVAR", c:"47006171", tel:"983278458", p:"Valladolid", pt:13, im:2600, d:[["Canadá",4]]},
  {n:"IES LOS SAUCES", c:"49000391", tel:"980630686", p:"Zamora", pt:12.8, im:3900, d:[["Canadá",6]]},
  {n:"IES MATEO HERNÁNDEZ", c:"37006014", tel:"923222762", p:"Salamanca", pt:12.4, im:3300, d:[["Lituania",6],["Francia",3],["Alemania",2]]},
  {n:"IES FERNANDO I", c:"24018544", tel:"987752280", p:"León", pt:12.25, im:2100, d:[["Eslovenia",7]]},
  {n:"IES VIRGEN DEL ESPINO", c:"42002744", tel:"975240808", p:"Soria", pt:12.2, im:5000, d:[["Países Bajos",12],["Alemania",20]]},
  {n:"IES RIBERA DEL DUERO", c:"09008639", tel:"947540153", p:"Burgos", pt:12, im:2400, d:[["Italia",8]]},
  {n:"IES DELICIAS", c:"47004913", tel:"983220716", p:"Valladolid", pt:12, im:5000, d:[["Canadá",4],["Alemania",10]]},
  {n:"IES JUAN DE JUNI", c:"47006673", tel:"983333455", p:"Valladolid", pt:11.4, im:5000, d:[["Canadá",8]]},
  {n:"IES LEÓN FELIPE", c:"49000418", tel:"980630364", p:"Zamora", pt:11.2, im:4500, d:[["Italia",15]]},
  {n:"IES ORDOÑO II", c:"24006049", tel:"987223200", p:"León", pt:10.75, im:1800, d:[["Noruega",6]]},
  {n:"IES VÍA DE LA PLATA", c:"37010108", tel:"923581066", p:"Salamanca", pt:10.55, im:3000, d:[["Italia",10]]},
  {n:"IES EULOGIO FLORENTINO SANZ", c:"05000427", tel:"920300221", p:"Ávila", pt:10.5, im:3900, d:[["Francia",13]]},
  {n:"IES LA RAMBLA", c:"42003700", tel:"975351203", p:"Soria", pt:10.2, im:1200, d:[["Francia",4]]},
  {n:"IES EMILIO FERRARI", c:"47004585", tel:"983334854", p:"Valladolid", pt:10.2, im:3900, d:[["Alemania",13]]},
  {n:"IES RECESVINTO", c:"34003749", tel:"979770236", p:"Palencia", pt:10, im:3000, d:[["Italia",10]]},
  {n:"IES VICTORIO MACHO", c:"34003038", tel:"979751133", p:"Palencia", pt:9.55, im:5000, d:[["Italia",9],["Hungría",9]]},
  {n:"IES EL SEÑOR DE BEMBIBRE", c:"24000990", tel:"987510156", p:"León", pt:9.25, im:1200, d:[["Alemania",4]]},
  {n:"IES JAIME GIL DE BIEDMA", c:"40002169", tel:"921580127", p:"Segovia", pt:9.2, im:3600, d:[["Francia",12]]},
  {n:"IES MERINDADES DE CASTILLA", c:"09007179", tel:"947131267", p:"Burgos", pt:9.15, im:3600, d:[["República Checa",12]]},
  {n:"IES VASCO DE LA ZARZA", c:"05000737", tel:"920227300", p:"Ávila", pt:9, im:1500, d:[["Francia",5]]},
  {n:"IES DIEGO MARÍN AGUILERA", c:"09008263", tel:"947485054", p:"Burgos", pt:9, im:5000, d:[["Alemania",20]]},
  {n:"IES LANCIA", c:"24017497", tel:"987259800", p:"León", pt:9, im:1200, d:[["Francia",4]]},
  {n:"IES JULIÁN MARÍAS", c:"47007525", tel:"983354733", p:"Valladolid", pt:8.75, im:5000, d:[["Noruega",8],["Alemania",20]]},
  {n:"IES GIL Y CARRASCO", c:"24008381", tel:"987410061", p:"León", pt:8.25, im:3000, d:[["Francia",10]]},
  {n:"IES ALFONSO VI", c:"47005991", tel:"983444000", p:"Valladolid", pt:8.2, im:5000, d:[["Francia",20]]},
  {n:"IES ZORRILLA", c:"47004615", tel:"983355090", p:"Valladolid", pt:8.2, im:5000, d:[["Francia",30]]},
  {n:"IES ALONSO BERRUGUETE", c:"34001911", tel:"979165850", p:"Palencia", pt:8.15, im:5000, d:[["Alemania",6],["Países Bajos",6],["Francia",6],["Suecia",6]]},
  {n:"IES LUCÍA DE MEDRANO", c:"37005861", tel:"923230625", p:"Salamanca", pt:8.1, im:2600, d:[["Canadá",4]]},
  {n:"IES FERNANDO DE ROJAS", c:"37008084", tel:"923182372", p:"Salamanca", pt:8, im:4550, d:[["Canadá",7]]},
  {n:"IES MARGARITA DE FUENMAYOR", c:"42003670", tel:"976647022", p:"Soria", pt:8, im:5000, d:[["Italia",25]]},
  {n:"IES CONDE DIEGO PORCELOS", c:"09001670", tel:"947221825", p:"Burgos", pt:7.25, im:4200, d:[["Alemania",14]]},
  {n:"IES VALLE DEL ARLANZA", c:"09007696", tel:"947458809", p:"Burgos", pt:7.25, im:5000, d:[["Canadá",4],["Eslovenia",10]]},
  {n:"IES DOCTORA MARÍA JOSÉ ALONSO", c:"24002494", tel:"987357101", p:"León", pt:7, im:1200, d:[["Francia",4]]},
  {n:"IES PARQUESOL", c:"47007011", tel:"983352855", p:"Valladolid", pt:7, im:5000, d:[["Francia",29]]},
  {n:"IES SANTA MARÍA LA REAL", c:"34003932", tel:"979125801", p:"Palencia", pt:7, im:5000, d:[["Italia",20]]},
  {n:"IES ISABEL DE CASTILLA", c:"05000725", tel:"920352144", p:"Ávila", pt:6.3, im:5000, d:[["Estados Unidos",22]]},
  {n:"IES JUAN DEL ENZINA", c:"24006037", tel:"987239000", p:"León", pt:6, im:1800, d:[["Noruega",6]], nota:"El centro desistió de su intercambio con un centro de Finlandia para 4 alumnos/as (Resuelvo Segundo de la Orden EDU/571/2026)."},
  {n:"IES LEOPOLDO CANO", c:"47004597", tel:"983293659", p:"Valladolid", pt:6, im:3600, d:[["Alemania",12]]},
  {n:"IES PADRE ISLA", c:"24006050", tel:"987200100", p:"León", pt:6, im:5000, d:[["Alemania",25]]}
];

var CONCERTADOS = [
  {n:"Colegio SAGRADO CORAZÓN (Dueñas)", c:"34000281", tel:"979770649", p:"Palencia", pt:10.95, im:5000, d:[["Alemania",18]]},
  {n:"Colegio LA SALLE", c:"34001698", tel:"979742500", p:"Palencia", pt:10.20, im:5000, d:[["Francia",25],["Países Bajos",25]]},
  {n:"Colegio SAN JOSÉ (Salamanca)", c:"37005745", tel:"923226004", p:"Salamanca", pt:9.95, im:4500, d:[["Alemania",15]]},
  {n:"Colegio MEDALLA MILAGROSA", c:"49005891", tel:"980533664", p:"Zamora", pt:9.75, im:3000, d:[["Francia",10]]},
  {n:"Colegio SAGRADO CORAZÓN (León)", c:"24005823", tel:"987238554", p:"León", pt:9.45, im:5000, d:[["Francia",30]]},
  {n:"Colegio SAN JOSÉ", c:"34001716", tel:"979720580", p:"Palencia", pt:9.30, im:4500, d:[["Alemania",15]]},
  {n:"Colegio PABLO VI", c:"05000661", tel:"920223157", p:"Ávila", pt:9.25, im:5000, d:[["Reino Unido",20],["Alemania",15]]},
  {n:"Colegio CALASANZ", c:"37005526", tel:"923267961", p:"Salamanca", pt:9.10, im:5000, d:[["Francia",18]]}
];

var FLAGS = {
  "Alemania":"🇩🇪","Francia":"🇫🇷","Canadá":"🇨🇦","Noruega":"🇳🇴","Estados Unidos":"🇺🇸",
  "Italia":"🇮🇹","Países Bajos":"🇳🇱","Lituania":"🇱🇹","Eslovenia":"🇸🇮","República Checa":"🇨🇿",
  "Hungría":"🇭🇺","Suecia":"🇸🇪","Reino Unido":"🇬🇧"
};

var CENTROS = PUBLICOS.map(function(x){ return Object.assign({tipo:"publico"}, x); })
  .concat(CONCERTADOS.map(function(x){ return Object.assign({tipo:"concertado"}, x); }));
