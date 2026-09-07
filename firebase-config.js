/* ============================================================================
   firebase-config.js
   ----------------------------------------------------------------------------
   Pega aquí las claves de TU proyecto de Firebase (Firebase console →
   Configuración del proyecto → Tus apps → SDK setup and configuration).
   No pasa nada porque estas claves sean públicas / estén en GitHub: Firebase
   está diseñado así, la protección real la dan las reglas de Firestore
   (archivo firestore.rules) y el usuario de Authentication, no el secreto de
   esta configuración. Instrucciones completas en README.md.
   ============================================================================ */

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPIELHhLz4LH7EKUHweYkcMmt8lKT4N1k",
  authDomain: "intercambios2627.firebaseapp.com",
  projectId: "intercambios2627",
  storageBucket: "intercambios2627.firebasestorage.app",
  messagingSenderId: "581281112333",
  appId: "1:581281112333:web:f62e64f6f074be59959044"
};

/* Email fijo del usuario "administrador" que creaste en Firebase Authentication.
   Los administradores solo necesitan recordar la CONTRASEÑA (la clave de
   administrador); este correo es un detalle técnico interno, no hace falta
   que lo escriban. Ver README.md, paso 3. */
var ADMIN_EMAIL = "admin@intercambios-crfptic.local";
