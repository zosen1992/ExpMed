import React, { useState, useEffect } from 'react';
import "../Estilos/Principal.css";
import { BsPersonBadge, BsInfoLg } from "react-icons/bs";
import { MdOutlineEmojiPeople, MdOutlineGroups, MdNotificationsActive, MdAdminPanelSettings } from "react-icons/md";
import { ImExit } from "react-icons/im";
import { TbClock } from "react-icons/tb";
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { ref, onValue, get } from 'firebase/database';

function Principal() {
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;
  const [noLeidas, setNoLeidas] = useState(0);
  const [rolConfirmado, setRolConfirmado] = useState('');
  const [verificandoPerfil, setVerificandoPerfil] = useState(true);

  useEffect(() => {
    // Si Login.jsx está en medio de una validación, esperamos sin redirigir en bucle
    if (sessionStorage.getItem('validandoRolLogin') === 'true') {
      return;
    }

    if (!myuid) {
      setVerificandoPerfil(false);
      return;
    }

    let unsubscribeNotif = null;

    const asegurarPerfilEnBD = async () => {
      try {
        const rolGuardado = (localStorage.getItem('rolActivo') || '').toLowerCase();

        // Si existe rolGuardado validamos primero esa rama; si no, buscamos en todas para evitar bucle con /login
        let ramasABuscar = ['admin', 'medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'otro'];
        if (rolGuardado) {
          if (rolGuardado === 'enfermeria' || rolGuardado === 'enfermero' || rolGuardado === 'enfemero') {
            ramasABuscar = ['enfermeria', 'enfermero', 'enfemero'];
          } else if (rolGuardado === 'admin' || rolGuardado === 'otro') {
            ramasABuscar = ['admin', 'otro'];
          } else {
            ramasABuscar = [rolGuardado];
          }
        }

        let encontrado = false;
        let rolFinal = '';

for (const r of ramasABuscar) {
          const snap = await get(ref(db, `usuarios/${r}/${myuid}`));
          if (snap.exists()) {
            const data = snap.val();
            const rolBD = (data.rol || r).toLowerCase();

            if (r === 'admin' || r === 'otro' || rolBD === 'admin' || rolBD === 'otro') {
              rolFinal = 'admin';
            } else if (r === 'enfermeria' || r === 'enfermero' || r === 'enfemero' || rolBD.includes('enfermer')) {
              rolFinal = 'enfermeria';
            } else if (r === 'px' || rolBD === 'px') {
              rolFinal = 'px';
            } else {
              rolFinal = 'medico';
            }

            // Validar vigencia al recargar la página si es Médico o Enfermería
            if (rolFinal === 'medico' || rolFinal === 'enfermeria') {
              const vigStr = (data.vigencia || '').trim();
              let fechaVig = null;
              if (vigStr && vigStr.toUpperCase() !== 'N/A') {
                const sep = vigStr.includes('/') ? '/' : '-';
                const p = vigStr.split(sep);
                if (p.length === 3) {
                  const [a, m, d] = p[0].length === 4 ? p.map(Number) : [Number(p[2]), Number(p[1]), Number(p[0])];
                  fechaVig = new Date(a, m - 1, d, 23, 59, 59, 999);
                }
              }
              if (!fechaVig || isNaN(fechaVig.getTime()) || new Date() > fechaVig) {
                localStorage.removeItem('rolActivo');
                await signOut(auth);
                setRolConfirmado('');
                setVerificandoPerfil(false);
                navigate('/login', { replace: true });
                return;
              }
            }

            encontrado = true;
            break;
          }
        }

        if (!encontrado) {
          // Si definitivamente no existe en ninguna rama permitida, cerramos la sesión de Firebase para no ciclar con App.jsx
          localStorage.removeItem('rolActivo');
          await signOut(auth);
          setRolConfirmado('');
          setVerificandoPerfil(false);
          navigate('/login', { replace: true });
          return;
        }

        // Guardamos el rol confirmado en localStorage
        localStorage.setItem('rolActivo', rolFinal);
        window.dispatchEvent(new Event('rolVerificado'));

        if (rolFinal === 'px') {
          setVerificandoPerfil(false);
          navigate(`/px/${myuid}`, { replace: true });
          return;
        }

        setRolConfirmado(rolFinal);
        setVerificandoPerfil(false);

        // Escuchar notificaciones una vez confirmado el perfil
        const notifRef = ref(db, `notificaciones/${myuid}`);
        unsubscribeNotif = onValue(notifRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const sinLeer = Object.values(data).filter(n => !n.leido).length;
            setNoLeidas(sinLeer);
          } else {
            setNoLeidas(0);
          }
        });
      } catch (error) {
        console.error("Error al verificar perfil:", error);
        setVerificandoPerfil(false);
      }
    };

    asegurarPerfilEnBD();

    return () => {
      if (unsubscribeNotif) unsubscribeNotif();
    };
  }, [myuid, navigate]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('rolActivo');
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  if (verificandoPerfil || !rolConfirmado) {
    return null;
  }

  const esEnfermeria = rolConfirmado === 'enfermeria';
  const esAdmin = rolConfirmado === 'admin';

  return (
    <div className='dashboard-container'>
        <h2 className='dashboard-title'>Panel de Control</h2>
        
        <div className='dashboard-grid'> 

            {/* 1. ADMINISTRAR PERFILES (Solo Admin) */}
            {esAdmin && (
                <Link to="/admin/usuarios" className='dashboard-card' style={{ border: '2px solid #3498db' }}>        
                    <MdAdminPanelSettings className='card-icon' style={{ color: '#2980b9' }} />
                    <span className='card-title'>Administrar Perfiles</span>
                </Link>
            )}

            {/* AGENDA: Solo Médico */}
            {!esAdmin && !esEnfermeria && (
                <Link to="/Agenda" className='dashboard-card'>        
                    <TbClock className='card-icon' />
                    <span className='card-title'>Agenda</span>
                </Link>
            )}

            {/* MIS PACIENTES: Solo Médico y Enfermería */}
            {!esAdmin && (
                <Link to="/listapx" className='dashboard-card'>        
                    <MdOutlineEmojiPeople className='card-icon' />
                    <span className='card-title'>Mis Pacientes</span>
                </Link>
            )}

            {/* 2. NOTIFICACIONES (Médico, Enfermería y Admin) */}
            <Link to="/notificaciones" className='dashboard-card' style={{ position: 'relative' }}>        
                <MdNotificationsActive className='card-icon' style={{ color: noLeidas > 0 ? '#e74c3c' : '#3498db' }} />
                <span className='card-title'>Notificaciones</span>
                {noLeidas > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        boxShadow: '0 2px 6px rgba(231, 76, 60, 0.4)'
                    }}>
                        {noLeidas} nueva{noLeidas > 1 ? 's' : ''}
                    </span>
                )}
            </Link>

            {/* CONSULTA GENERAL: Solo Médico */}
            {!esAdmin && !esEnfermeria && (
                <Link to="/Consulta_general" className='dashboard-card'>        
                    <MdOutlineGroups className='card-icon' />
                    <span className='card-title'>Consulta General</span>
                </Link>
            )}

            {/* 3. MI PERFIL (Médico, Enfermería y Admin) */}
            {myuid && (
                <Link to={`/Miperfil/${myuid}`} className='dashboard-card'>      
                    <BsPersonBadge className='card-icon' />
                    <span className='card-title'>Mi Perfil</span>
                </Link>
            )}

            {/* ACERCA DE: Oculta para Admin */}
            {!esAdmin && (
                <Link to="/acerca" className='dashboard-card'>        
                    <BsInfoLg className='card-icon' />
                    <span className='card-title'>Acerca de</span>
                </Link>
            )}

            {/* 4. CERRAR SESIÓN (Médico, Enfermería y Admin) */}
            <div onClick={handleLogout} className='dashboard-card logout-card'>      
                <ImExit className='card-icon' />
                <span className='card-title'>Cerrar Sesión</span>
            </div>

        </div>
    </div>
  );
}

export default Principal;