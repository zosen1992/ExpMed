import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { FaUserShield, FaLock, FaEnvelope, FaUserTag } from 'react-icons/fa';
import { evaluarYNotificarVigenciaUsuario } from '../utilidades/verificadorVigencia';

// Convierte fechas en formato YYYY-MM-DD o DD/MM/YYYY a objeto Date local (a las 23:59:59 de ese día)
const parsearFechaVigencia = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== 'string') return null;
  const limpio = fechaStr.trim();
  if (!limpio || limpio.toUpperCase() === 'N/A') return null;

  let anio, mes, dia;

  if (limpio.includes('/')) {
    const partes = limpio.split('/');
    if (partes.length === 3) {
      // Formato DD/MM/YYYY o YYYY/MM/DD
      if (partes[0].length === 4) {
        [anio, mes, dia] = partes.map(Number);
      } else {
        [dia, mes, anio] = partes.map(Number);
      }
    }
  } else if (limpio.includes('-')) {
    const partes = limpio.split('-');
    if (partes.length === 3) {
      // Formato YYYY-MM-DD o DD-MM-YYYY
      if (partes[0].length === 4) {
        [anio, mes, dia] = partes.map(Number);
      } else {
        [dia, mes, anio] = partes.map(Number);
      }
    }
  }

  if (!anio || !mes || !dia) return null;
  const fecha = new Date(anio, mes - 1, dia, 23, 59, 59, 999);
  return isNaN(fecha.getTime()) ? null : fecha;
};

const Login = () => {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [rolSeleccionado, setRolSeleccionado] = useState('medico');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);

    localStorage.removeItem('rolActivo');
    sessionStorage.setItem('validandoRolLogin', 'true');

    try {
      const cred = await signInWithEmailAndPassword(auth, correo.trim(), password);
      const uid = cred.user.uid;

      let ramasValidas = [rolSeleccionado];
      if (rolSeleccionado === 'enfermeria') {
        ramasValidas = ['enfermeria', 'enfermero', 'enfemero'];
      } else if (rolSeleccionado === 'admin') {
        ramasValidas = ['admin', 'otro'];
      }

      let datosUsuario = null;
      let ramaEncontrada = '';

      for (const r of ramasValidas) {
        const snap = await get(ref(db, `usuarios/${r}/${uid}`));
        if (snap.exists()) {
          datosUsuario = snap.val();
          ramaEncontrada = r;
          break;
        }
      }

      if (!datosUsuario) {
        await signOut(auth);
        sessionStorage.removeItem('validandoRolLogin');
        setCargando(false);
        alert(`Acceso denegado: Tu cuenta no pertenece al perfil de "${rolSeleccionado.toUpperCase()}".`);
        return;
      }

      if (rolSeleccionado === 'medico' || rolSeleccionado === 'enfermeria') {
        await evaluarYNotificarVigenciaUsuario(uid, datosUsuario, ramaEncontrada);
      }
      // VALIDACIÓN DE VIGENCIA PARA MÉDICO Y ENFERMERÍA
      if (rolSeleccionado === 'medico' || rolSeleccionado === 'enfermeria') {
        const fechaLimiteVigencia = parsearFechaVigencia(datosUsuario.vigencia);
        const fechaActual = new Date();

        if (!fechaLimiteVigencia || fechaActual > fechaLimiteVigencia) {
          await signOut(auth);
          sessionStorage.removeItem('validandoRolLogin');
          setCargando(false);
          alert(
            `⛔ Acceso denegado: La vigencia de tu cuenta (${datosUsuario.vigencia || 'Sin vigencia'}) se ha superado.\n\n` +
            `Por favor contacta al Administrador para renovar tu acceso.`
          );
          return;
        }
      }

      const rolGuardar = rolSeleccionado === 'admin' ? 'admin' : ramaEncontrada;
      localStorage.setItem('rolActivo', rolGuardar);
      sessionStorage.removeItem('validandoRolLogin');
      window.dispatchEvent(new Event('rolVerificado'));

      if (rolGuardar === 'px') {
        navigate(`/px/${uid}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error("Error en login:", error);
      sessionStorage.removeItem('validandoRolLogin');
      alert("Credenciales incorrectas o usuario no encontrado.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={iconHeaderStyle}>
          <FaUserShield />
        </div>
        <h2 style={{ textAlign: 'center', color: '#1e293b', margin: '0 0 6px 0' }}>Acceso al Sistema Clínico</h2>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '22px' }}>
          Selecciona tu perfil e ingresa tus credenciales
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={labelStyle}><FaUserTag /> Tipo de Perfil</label>
            <select
              value={rolSeleccionado}
              onChange={(e) => setRolSeleccionado(e.target.value)}
              style={inputStyle}
            >
              <option value="medico">Médico</option>
              <option value="enfermeria">Enfermería</option>
              <option value="px">Paciente</option>
              <option value="admin">Administrador (Admin)</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}><FaEnvelope /> Correo Electrónico</label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}><FaLock /> Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              style={inputStyle}
            />
          </div>

          <button type="submit" disabled={cargando} style={btnStyle}>
            {cargando ? 'Verificando perfil y vigencia...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

const pageStyle = {
  minHeight: '88vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
  padding: '20px', fontFamily: 'Segoe UI, Roboto, sans-serif', backgroundColor: '#f8fafc'
};
const cardStyle = {
  backgroundColor: '#fff', width: '100%', maxWidth: '410px', padding: '32px 28px',
  borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0'
};
const iconHeaderStyle = {
  width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#e8f4fd',
  color: '#3498db', display: 'flex', justifyContent: 'center', alignItems: 'center',
  fontSize: '1.6rem', margin: '0 auto 12px auto'
};
const labelStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem',
  fontWeight: 600, color: '#334155', marginBottom: '6px'
};
const inputStyle = {
  width: '100%', padding: '11px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
  fontSize: '0.95rem', color: '#1e293b', boxSizing: 'border-box', outline: 'none'
};
const btnStyle = {
  backgroundColor: '#3498db', color: '#fff', border: 'none', padding: '12px',
  borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', marginTop: '6px'
};

export default Login;