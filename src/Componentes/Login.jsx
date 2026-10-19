import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { FaUserShield, FaLock, FaEnvelope, FaUserTag } from 'react-icons/fa';
import { evaluarYNotificarVigenciaUsuario, estaVigenciaVencida } from '../utilidades/verificadorVigencia';

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
    localStorage.removeItem('vigenciaVencida');
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

      // Evaluar notificaciones de vigencia (7, 3, 1, -2 días) y estado de vigencia vencida
      if (rolSeleccionado === 'medico' || rolSeleccionado === 'enfermeria') {
        await evaluarYNotificarVigenciaUsuario(uid, datosUsuario, ramaEncontrada);
        const vencida = estaVigenciaVencida(datosUsuario.vigencia);
        localStorage.setItem('vigenciaVencida', vencida ? 'true' : 'false');

        if (vencida) {
          alert(
            `⚠️ Aviso de Vigencia Vencida (${datosUsuario.vigencia || 'N/A'}):\n\n` +
            `Has ingresado en MODO SOLO LECTURA. Solo podrás consultar a tus pacientes asignados y visualizar únicamente los registros creados por ti, sin poder agregar, editar ni eliminar información.`
          );
        }
      } else {
        localStorage.setItem('vigenciaVencida', 'false');
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
            {cargando ? 'Verificando perfil...' : 'Iniciar Sesión'}
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