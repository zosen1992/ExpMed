import React, { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useParams, Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { ref, get } from 'firebase/database';

// Componentes existentes
import Login from './Componentes/Login';
import Principal from './Componentes/Principal';
import Listapx from './Componentes/Listapx';
import Menupx from './Componentes/Menupx';
import Formularionpx from './Componentes/Formularionpx';
import Datospx from './Componentes/Datospx';
import Miperfil from './Componentes/Miperfil';
import TopBar from './Componentes/TopBar';
import Alergias from './Componentes/Alergias';
import PHc from './Componentes/PHc';
import Sv from './Componentes/Sv';
import Consulta from './Componentes/Consulta';
import Notificaciones from './Componentes/Notificaciones';
import BuscarProfesional from './Componentes/BuscarProfesional';
import ConsultaGeneral from './Componentes/ConsultaGeneral';
import AdminUsuarios from './Componentes/AdminUsuarios';
import Agenda from './Componentes/Agenda';
import CitasPaciente from './Componentes/CitasPaciente';
import ChatInterno from './Componentes/ChatInterno';

// Vista provisional para "Estudios" y "Acerca de" mientras los creamos más adelante
const ModuloPendiente = ({ titulo, esEstudios = false }) => {
  const { id } = useParams();
  const rutaRegreso = esEstudios && id ? `/px/${id}` : '/';
  return (
    <div style={{ maxWidth: '500px', margin: '60px auto', padding: '30px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.06)', fontFamily: 'Segoe UI, sans-serif' }}>
      <h2 style={{ color: '#2c3e50', marginTop: 0 }}>{titulo}</h2>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Este módulo se habilitará próximamente.</p>
      <Link to={rutaRegreso} style={{ display: 'inline-block', backgroundColor: '#3498db', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>
        ← Regresar
      </Link>
    </div>
  );
};

// Guardianes de rutas
const RutaProtegida = ({ usuario, children }) => {
  return usuario ? children : <Navigate to="/login" replace />;
};

const RutaSoloPersonal = ({ usuario, esPx, children }) => {
  if (!usuario) return <Navigate to="/login" replace />;
  if (esPx) return <Navigate to={`/px/${usuario.uid}`} replace />;
  return children;
};

const RutaSinEnfermeriaNiPx = ({ usuario, esPx, esEnfermeria, children }) => {
  const { id } = useParams();
  if (!usuario) return <Navigate to="/login" replace />;
  if (esPx) return <Navigate to={`/px/${usuario.uid}`} replace />;
  if (esEnfermeria) return <Navigate to={id ? `/px/${id}` : "/listapx"} replace />;
  return children;
};

function App() {
  const [usuario, setUsuario] = useState(null);
  const [rolActivo, setRolActivo] = useState(localStorage.getItem('rolActivo') || null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Asegura que la URL del navegador se mantenga en la ruta base (ej. /DemoExp/)
    // Así, al presionar F5 desde cualquier pantalla, el servidor siempre carga la primera página
    const baseUrl = import.meta.env.BASE_URL || '/';
    if (window.location.pathname !== baseUrl) {
      window.history.replaceState(null, '', baseUrl);
    }

    const sincronizarRol = async (user) => {
      if (!user) {
        setUsuario(null);
        setRolActivo(null);
        localStorage.removeItem('rolActivo');
        setCargando(false);
        return;
      }

      setUsuario(user);

      // Si Login.jsx está validando credenciales y rol, esperamos a que termine
      if (sessionStorage.getItem('validandoRolLogin') === 'true') {
        setCargando(false);
        return;
      }

      const rolGuardado = localStorage.getItem('rolActivo');
      if (rolGuardado) {
        setRolActivo(rolGuardado);
      } else {
        const ramas = ['admin', 'medico', 'enfermeria', 'enfermero', 'enfemero', 'otro', 'px'];
        for (const r of ramas) {
          const snap = await get(ref(db, `usuarios/${r}/${user.uid}`));
          if (snap.exists()) {
            const rolNormalizado = (r === 'enfermero' || r === 'enfemero') ? 'enfermeria' : (r === 'otro' ? 'admin' : r);
            localStorage.setItem('rolActivo', rolNormalizado);
            setRolActivo(rolNormalizado);
            break;
          }
        }
      }
      setCargando(false);
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      sincronizarRol(user);
    });

    const handleRolVerificado = () => {
      setRolActivo(localStorage.getItem('rolActivo'));
      if (auth.currentUser) {
        setUsuario(auth.currentUser);
      }
    };

    window.addEventListener('rolVerificado', handleRolVerificado);
    return () => {
      unsubscribe();
      window.removeEventListener('rolVerificado', handleRolVerificado);
    };
  }, []);

  if (cargando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20vh', fontFamily: 'Segoe UI, sans-serif' }}>
        <h2>Cargando aplicación...</h2>
      </div>
    );
  }

  const rolActual = (localStorage.getItem('rolActivo') || rolActivo || '').toLowerCase();
  const esPx = rolActual === 'px';
  const esEnfermeria = rolActual === 'enfermeria' || rolActual.includes('enfermer');

  return (
    <MemoryRouter initialEntries={['/']}>
      {usuario && rolActual && <TopBar />}

      <Routes>
        {/* LOGIN */}
        <Route 
          path="/login" 
          element={
            usuario && rolActual
              ? (esPx ? <Navigate to={`/px/${usuario.uid}`} replace /> : <Navigate to="/" replace />) 
              : <Login />
          } 
        />
        
        {/* RUTA PRINCIPAL (Si entra un paciente, lo lleva a su expediente; si es personal, al Panel de Control) */}
        <Route 
          path="/" 
          element={
            <RutaProtegida usuario={usuario}>
              {esPx && usuario ? <Navigate to={`/px/${usuario.uid}`} replace /> : <Principal />}
            </RutaProtegida>
          } 
        />

        {/* RUTAS DE PERSONAL */}
        <Route path="/listapx" element={<RutaSoloPersonal usuario={usuario} esPx={esPx}><Listapx /></RutaSoloPersonal>} />
        <Route path="/formulario" element={<RutaSoloPersonal usuario={usuario} esPx={esPx}><Formularionpx /></RutaSoloPersonal>} />
        <Route path="/Miperfil/:uid" element={<RutaSoloPersonal usuario={usuario} esPx={esPx}><Miperfil /></RutaSoloPersonal>} />
        <Route path="/Agenda" element={<RutaSoloPersonal usuario={usuario} esPx={esPx}><Agenda /></RutaSoloPersonal>} />
        <Route path="/admin/usuarios" element={<RutaSoloPersonal usuario={usuario} esPx={esPx}><AdminUsuarios /></RutaSoloPersonal>} />

        {/* RUTAS EXCLUSIVAS MÉDICO/ADMIN (Bloqueadas para Enfermería y Paciente) */}
        <Route path="/PHc/:id" element={<RutaSinEnfermeriaNiPx usuario={usuario} esPx={esPx} esEnfermeria={esEnfermeria}><PHc /></RutaSinEnfermeriaNiPx>} />
        <Route path="/Consulta_general" element={<RutaSinEnfermeriaNiPx usuario={usuario} esPx={esPx} esEnfermeria={esEnfermeria}><ConsultaGeneral /></RutaSinEnfermeriaNiPx>} />

        {/* RUTAS COMPARTIDAS (Habilitadas también para el Paciente) */}
        <Route path="/px/:id" element={<RutaProtegida usuario={usuario}><Menupx /></RutaProtegida>} />
        <Route path="/consulta/:id" element={<RutaProtegida usuario={usuario}><Consulta /></RutaProtegida>} />
        <Route path="/alergias/:id" element={<RutaProtegida usuario={usuario}><Alergias /></RutaProtegida>} />
        <Route path="/sv/:id" element={<RutaProtegida usuario={usuario}><Sv /></RutaProtegida>} />
        <Route path="/Datospx/:id" element={<RutaProtegida usuario={usuario}><Datospx /></RutaProtegida>} />
        <Route path="/mis-citas/:id" element={<RutaProtegida usuario={usuario}><CitasPaciente /></RutaProtegida>} />
        <Route path="/notificaciones" element={<RutaProtegida usuario={usuario}><Notificaciones /></RutaProtegida>} />
        <Route path="/buscar-profesional" element={<RutaProtegida usuario={usuario}><BuscarProfesional /></RutaProtegida>} />

        {/* VISTAS PROVISIONALES HASTA CREAR "ESTUDIOS" Y "ACERCA DE" */}
        <Route path="/Estudios/:id" element={<RutaProtegida usuario={usuario}><ModuloPendiente titulo="Estudios de Laboratorio y Gabinete" esEstudios={true} /></RutaProtegida>} />
        <Route path="/acerca" element={<RutaSoloPersonal usuario={usuario} esPx={esPx}><ModuloPendiente titulo="Acerca del Sistema" /></RutaSoloPersonal>} />

        {/* RUTAS DE CHAT INTERNO */}
        <Route path="/chat" element={<RutaProtegida usuario={usuario}><ChatInterno /></RutaProtegida>} />
        <Route path="/chat/:chatIdParam" element={<RutaProtegida usuario={usuario}><ChatInterno /></RutaProtegida>} />

        {/* COMODÍN */}
        <Route path="*" element={<Navigate to={esPx && usuario ? `/px/${usuario.uid}` : "/"} replace />} />
      </Routes>
    </MemoryRouter>
  );
}

export default App;