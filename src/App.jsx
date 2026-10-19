import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { ref, get } from 'firebase/database';

// Componentes
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



function App() {
  const [usuario, setUsuario] = useState(null);
  const [rolActivo, setRolActivo] = useState(localStorage.getItem('rolActivo') || null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        const rolGuardado = localStorage.getItem('rolActivo');
        if (rolGuardado) {
          setRolActivo(rolGuardado);
        } else {
          const ramas = ['admin', 'medico', 'enfermeria', 'otro', 'px'];
          for (const r of ramas) {
            const snap = await get(ref(db, `usuarios/${r}/${user.uid}`));
            if (snap.exists()) {
              localStorage.setItem('rolActivo', r);
              setRolActivo(r);
              break;
            }
          }
        }
      } else {
        setUsuario(null);
        setRolActivo(null);
        localStorage.removeItem('rolActivo');
      }
      setCargando(false);
    });
    return () => unsubscribe();
  }, []);

  if (cargando) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20vh' }}><h2>Cargando aplicación...</h2></div>;
  }

  const rolActual = localStorage.getItem('rolActivo') || rolActivo;
  const esPx = rolActual === 'px';
  const esEnfermeria = rolActual === 'enfermeria';

  const RutaProtegida = ({ children }) => {
    return usuario ? children : <Navigate to="/login" replace />;
  };

  const RutaSoloPersonal = ({ children }) => {
    if (!usuario) return <Navigate to="/login" replace />;
    if (esPx) return <Navigate to={`/px/${usuario.uid}`} replace />;
    return children;
  };

  // Bloquea tanto a Pacientes como a Enfermería de entrar a Historia Clínica
  const RutaSinEnfermeriaNiPx = ({ children }) => {
    const { id } = useParams();
    if (!usuario) return <Navigate to="/login" replace />;
    if (esPx) return <Navigate to={`/px/${usuario.uid}`} replace />;
    if (esEnfermeria) return <Navigate to={id ? `/px/${id}` : "/listapx"} replace />;
    return children;
  };

  return (
    <Router>
      {usuario && <TopBar />}

      <Routes>
        <Route 
          path="/login" 
          element={
            usuario 
              ? (esPx ? <Navigate to={`/px/${usuario.uid}`} replace /> : <Navigate to="/" replace />) 
              : <Login />
          } 
        />
        
        {/* RUTAS DE PERSONAL */}
        <Route path="/" element={<RutaSoloPersonal><Principal /></RutaSoloPersonal>} />
        <Route path="/listapx" element={<RutaSoloPersonal><Listapx /></RutaSoloPersonal>} />
        <Route path="/formulario" element={<RutaSoloPersonal><Formularionpx /></RutaSoloPersonal>} />
        <Route path="/Miperfil/:uid" element={<RutaSoloPersonal><Miperfil /></RutaSoloPersonal>} />
        <Route path="/consulta/:id" element={<RutaProtegida><Consulta /></RutaProtegida>} />

        {/* RUTA EXCLUSIVA MÉDICO/OTRO (Oculta y bloqueada para Enfermería y Paciente) */}
        <Route path="/PHc/:id" element={<RutaSinEnfermeriaNiPx><PHc /></RutaSinEnfermeriaNiPx>} />

        {/* RUTAS COMPARTIDAS */}
        <Route path="/Agenda" element={<RutaSoloPersonal><Agenda /></RutaSoloPersonal>} />
        <Route path="/mis-citas/:id" element={<RutaProtegida><CitasPaciente /></RutaProtegida>} />

        <Route path="/px/:id" element={<RutaProtegida><Menupx /></RutaProtegida>} />
        <Route path="/alergias/:id" element={<RutaProtegida><Alergias /></RutaProtegida>} />
        <Route path="/sv/:id" element={<RutaProtegida><Sv /></RutaProtegida>} />
        <Route path="/Datospx/:id" element={<RutaProtegida><Datospx /></RutaProtegida>} />
        <Route path="/notificaciones" element={<RutaSoloPersonal><Notificaciones /></RutaSoloPersonal>} />
        <Route path="/buscar-profesional" element={<RutaProtegida><BuscarProfesional /></RutaProtegida>} />
        <Route path="/Consulta_general" element={<RutaSinEnfermeriaNiPx><ConsultaGeneral /></RutaSinEnfermeriaNiPx>}  />
        <Route path="/admin/usuarios" element={<RutaSoloPersonal><AdminUsuarios /></RutaSoloPersonal>} />
        <Route path="/login" element={usuario && localStorage.getItem('rolActivo') ? <Navigate to="/" /> : <Login />} 
/>

        <Route path="*" element={<Navigate to={esPx && usuario ? `/px/${usuario.uid}` : "/"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;