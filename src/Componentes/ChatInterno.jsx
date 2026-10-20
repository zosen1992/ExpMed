import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ref, onValue, set, push, update, get, remove } from 'firebase/database';
import { 
  FaArrowLeft, FaPaperPlane, FaPlus, FaSearch, FaCheck, 
  FaCheckDouble, FaUserMd, FaUserNurse, FaUserInjured, 
  FaTimes, FaCheckCircle, FaTimesCircle, FaLock, 
  FaFolderOpen, FaBan, FaRedo, FaComments, FaClock, 
  FaExclamationCircle, FaUserPlus, FaFilePrescription, 
  FaPrint, FaHistory, FaNotesMedical, FaLeaf, FaTrashAlt
} from 'react-icons/fa';
import { estaVigenciaVencida } from '../utilidades/verificadorVigencia';
import ModalReceta from './ModalReceta';
import '../Estilos/ChatInterno.css';


const RESPUESTAS_RAPIDAS_PERSONAL = [
  "Hola, he revisado tu mensaje.",
  "Te comparto por este medio tu receta e indicaciones.",
  "Por favor agenda una cita para valorarte en consulta.",
  "En caso de urgencia acude al área médica más cercana."
];

const generarChatId = (uid1, uid2) => {
  return [uid1, uid2].sort().join('_');
};

const calcularEdad = (fechaString) => {
  if (!fechaString) return '';
  let fechaNacimiento = new Date(fechaString);
  if (isNaN(fechaNacimiento.getTime()) && fechaString.includes('/')) {
    const partes = fechaString.split('/');
    if (partes.length === 3) fechaNacimiento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
  }
  if (isNaN(fechaNacimiento.getTime())) return '';
  const hoy = new Date();
  let edadCalc = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const m = hoy.getMonth() - fechaNacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fechaNacimiento.getDate())) edadCalc--;
  return edadCalc;
};

const ChatInterno = () => {
  const { chatIdParam } = useParams();
  const navigate = useNavigate();
  const myuid = auth.currentUser?.uid;
  const mensajesEndRef = useRef(null);

  const [miPerfil, setMiPerfil] = useState(null);
  const [miPerfilCompletoMedico, setMiPerfilCompletoMedico] = useState({});
  const [miRol, setMiRol] = useState((localStorage.getItem('rolActivo') || '').toLowerCase());
  const [vigenciaVencida, setVigenciaVencida] = useState(
    localStorage.getItem('vigenciaVencida') === 'true'
  );

  const [misPacientesMap, setMisPacientesMap] = useState({});
  const [chats, setChats] = useState([]);
  const [chatActivoId, setChatActivoId] = useState(chatIdParam || null);
  const [mensajes, setMensajes] = useState([]);
  const [textoMensaje, setTextoMensaje] = useState('');
  const [filtroTab, setFiltroTab] = useState('ACTIVOS');
  const [busquedaChat, setBusquedaChat] = useState('');
  const [cargando, setCargando] = useState(true);

  // Estado para saber si el profesional con el que habla el paciente está "en descanso" (vigencia vencida)
  const [profesionalEnDescanso, setProfesionalEnDescanso] = useState(false);

  // Modal Directorio Nuevo Chat
  const [isModalDirectorioOpen, setIsModalDirectorioOpen] = useState(false);
  const [directorioContactos, setDirectorioContactos] = useState([]);
  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');
  const [filtroRolDirectorio, setFiltroRolDirectorio] = useState('TODOS');

  // Modal para Enviar / Generar Receta o Tratamiento desde el Chat
  const [isModalRecetaChatOpen, setIsModalRecetaChatOpen] = useState(false);
  const [tabRecetaChat, setTabRecetaChat] = useState('HISTORIAL'); // 'HISTORIAL' | 'NUEVA'
  const [notasHistoricasPx, setNotasHistoricasPx] = useState([]);
  const [cargandoNotasPx, setCargandoNotasPx] = useState(false);
  const [nuevaRecetaForm, setNuevaRecetaForm] = useState({
    motivo: 'Orientación y seguimiento por chat clínico',
    diagnostico: '',
    tratamiento: '',
    guardarEnExpediente: true
  });
  const [enviandoReceta, setEnviandoReceta] = useState(false);

  // Modal Vista Previa / Impresión de Receta Oficial (tanto para Médico como Paciente)
  const [recetaActivaPreview, setRecetaActivaPreview] = useState(null);

  const esPx = miRol === 'px';
  const esMedico = miRol === 'medico';
  const esPersonalSalud = miRol === 'medico' || miRol === 'enfermeria' || miRol.includes('enfermer');

  useEffect(() => {
    if (chatIdParam) {
      setChatActivoId(chatIdParam);
    }
  }, [chatIdParam]);

  // 1. Cargar datos del usuario actual y validar su vigencia
  useEffect(() => {
    if (!myuid) return;

    const cargarMiUsuario = async () => {
      const rolLocal = (localStorage.getItem('rolActivo') || '').toLowerCase();
      const ramas = rolLocal 
        ? [rolLocal, 'medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'] 
        : ['medico', 'enfermeria', 'enfermero', 'enfemero', 'px', 'admin', 'otro'];

      for (const r of ramas) {
        const snap = await get(ref(db, `usuarios/${r}/${myuid}`));
        if (snap.exists()) {
          const data = snap.val();
          const rolNorm = (r === 'enfermero' || r === 'enfemero' || String(data.rol).toLowerCase().includes('enfermer'))
            ? 'enfermeria'
            : (r === 'otro' ? 'admin' : r);

          setMiRol(rolNorm);

          // Si es médico, verificar también su firma en fimas/[myuid] por si no está en el nodo raíz
          let firmaGuardada = data.firma || '';
          if (rolNorm === 'medico' && !firmaGuardada) {
            const snapFirma = await get(ref(db, `fimas/${myuid}`));
            if (snapFirma.exists()) firmaGuardada = snapFirma.val().url || '';
          }

          setMiPerfilCompletoMedico({ ...data, firma: firmaGuardada });
          setMiPerfil({
            uid: myuid,
            nombre: data.nombre || data.nombrecom || 'Usuario',
            rol: rolNorm,
            especialidad: data.especialidad1 || data.especialidad_enf || '',
            fotoperfil: data.fotoperfil || '',
            localidad: data.localidad || ''
          });

          if (rolNorm === 'medico' || rolNorm === 'enfermeria') {
            const vencida = estaVigenciaVencida(data.vigencia);
            setVigenciaVencida(vencida);
            localStorage.setItem('vigenciaVencida', vencida ? 'true' : 'false');
          } else {
            setVigenciaVencida(false);
          }
          break;
        }
      }
    };

    cargarMiUsuario();

    const misPxRef = ref(db, `px/${myuid}`);
    const unsubMisPx = onValue(misPxRef, (snap) => {
      setMisPacientesMap(snap.exists() ? snap.val() : {});
    });

    return () => unsubMisPx();
  }, [myuid]);

  // 2. Escuchar todas las conversaciones del usuario
  useEffect(() => {
    if (!myuid) return;

    const chatsRef = ref(db, 'chats');
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const misChats = [];

        Object.keys(data).forEach((id) => {
          const info = data[id]?.info;
          if (info && info.participantes && info.participantes[myuid]) {
            misChats.push({
              chatId: id,
              ...info
            });
          }
        });

        misChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setChats(misChats);
      } else {
        setChats([]);
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, [myuid]);

  // Obtener información del chat activo y del otro interlocutor
  const chatActivoObj = chats.find((c) => c.chatId === chatActivoId) || null;
  const otroUid = chatActivoObj?.participantes
    ? Object.keys(chatActivoObj.participantes).find((u) => u !== myuid)
    : null;
  const otroParticipante = (chatActivoObj && otroUid && chatActivoObj.datosParticipantes?.[otroUid]) || {
    uid: otroUid,
    nombre: 'Usuario',
    rol: ''
  };

  // 3. Verificar en tiempo real si el profesional con el que habla el usuario tiene su vigencia vencida ("En descanso")
  useEffect(() => {
    if (!otroUid || !otroParticipante.rol || otroParticipante.rol === 'px') {
      setProfesionalEnDescanso(false);
      return;
    }

    const verificarDisponibilidadProfesional = async () => {
      const ramasProf = otroParticipante.rol === 'medico'
        ? ['medico']
        : ['enfermeria', 'enfermero', 'enfemero'];

      for (const r of ramasProf) {
        const snap = await get(ref(db, `usuarios/${r}/${otroUid}`));
        if (snap.exists()) {
          const datosProf = snap.val();
          const vencida = estaVigenciaVencida(datosProf.vigencia);
          setProfesionalEnDescanso(vencida);
          return;
        }
      }
      setProfesionalEnDescanso(false);
    };

    verificarDisponibilidadProfesional();
  }, [otroUid, otroParticipante.rol, chatActivoId]);

  // 4. Escuchar mensajes del chat activo y marcarlos como leídos
  useEffect(() => {
    if (!chatActivoId || !myuid) {
      setMensajes([]);
      return;
    }

    const msgRef = ref(db, `chats/${chatActivoId}/mensajes`);
    const unsubscribe = onValue(msgRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMensajes(lista);

        const actualizaciones = {};
        let huboCambios = false;
        lista.forEach((m) => {
          if (m.emisorUid !== myuid && !m.leido) {
            actualizaciones[`chats/${chatActivoId}/mensajes/${m.id}/leido`] = true;
            huboCambios = true;
          }
        });

        actualizaciones[`chats/${chatActivoId}/info/noLeidos/${myuid}`] = 0;

        if (huboCambios) {
          await update(ref(db), actualizaciones);
        } else {
          await set(ref(db, `chats/${chatActivoId}/info/noLeidos/${myuid}`), 0);
        }
      } else {
        setMensajes([]);
      }
    });

    return () => unsubscribe();
  }, [chatActivoId, myuid]);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, chatActivoId]);

  const enviarNotificacionChat = async (uidDestino, tituloNombre, detalleTexto, chatId) => {
    if (!uidDestino || uidDestino === myuid) return;
    try {
      const ahoraFormato = new Date().toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const nuevaNotifRef = push(ref(db, `notificaciones/${uidDestino}`));
      await set(nuevaNotifRef, {
        idNotif: nuevaNotifRef.key,
        tipoNotif: 'CHAT',
        uidDestino,
        nombrePx: tituloNombre,
        detalleTexto,
        alertas: [detalleTexto],
        capturadoPor: miPerfil?.nombre || 'Chat Clínico',
        fecha: ahoraFormato,
        timestamp: Date.now(),
        leido: false,
        rutaDestino: `/chat/${chatId}`
      });
    } catch (error) {
      console.error("Error al enviar notificación de chat:", error);
    }
  };

  // Cargar contactos para "+ Nuevo Mensaje"
  const abrirDirectorioContactos = async () => {
    if (vigenciaVencida && esPersonalSalud) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes iniciar nuevas conversaciones.");
    }

    try {
      const snapUsuarios = await get(ref(db, 'usuarios'));
      const snapRelacionesPx = await get(ref(db, 'px'));
      if (!snapUsuarios.exists()) return;

      const ramas = snapUsuarios.val();
      const relacionesPx = snapRelacionesPx.exists() ? snapRelacionesPx.val() : {};
      const listaContactos = [];

      const misMedicosAsignadosSet = new Set();
      if (esPx) {
        Object.keys(relacionesPx).forEach((uidProfesional) => {
          if (relacionesPx[uidProfesional] && relacionesPx[uidProfesional][myuid]) {
            misMedicosAsignadosSet.add(uidProfesional);
          }
        });
      }

      const ramasSalud = [
        { nodo: 'medico', etiqueta: 'Médico' },
        { nodo: 'enfermeria', etiqueta: 'Enfermería' },
        { nodo: 'enfermero', etiqueta: 'Enfermería' },
        { nodo: 'enfemero', etiqueta: 'Enfermería' }
      ];

      const uidsSaludAgregados = new Set();

      ramasSalud.forEach(({ nodo, etiqueta }) => {
        if (ramas[nodo]) {
          Object.keys(ramas[nodo]).forEach((uid) => {
            if (uid === myuid || uidsSaludAgregados.has(uid)) return;
            if (esPx && !misMedicosAsignadosSet.has(uid)) return;

            const u = ramas[nodo][uid];
            const enDescanso = estaVigenciaVencida(u.vigencia);

            uidsSaludAgregados.add(uid);
            listaContactos.push({
              uid,
              nombre: u.nombre || u.nombrecom || 'Profesional de Salud',
              rol: etiqueta === 'Médico' ? 'medico' : 'enfermeria',
              rolEtiqueta: etiqueta,
              especialidad: u.especialidad1 || u.especialidad_enf || u.especialidad || 'General',
              localidad: u.localidad || '',
              fotoperfil: u.fotoperfil || '',
              enDescanso
            });
          });
        }
      });

      if (esPersonalSalud && relacionesPx[myuid] && ramas.px) {
        const idsMisPx = Object.keys(relacionesPx[myuid]);
        idsMisPx.forEach((uidPx) => {
          const p = ramas.px[uidPx];
          if (p) {
            listaContactos.push({
              uid: uidPx,
              nombre: p.nombre || p.nombrecom || 'Paciente',
              rol: 'px',
              rolEtiqueta: 'Paciente',
              especialidad: `Paciente • ${p.localidad || ''}`,
              localidad: p.localidad || '',
              fotoperfil: p.fotoperfil || '',
              enDescanso: false
            });
          }
        });
      }

      setDirectorioContactos(listaContactos);
      setIsModalDirectorioOpen(true);
    } catch (error) {
      console.error("Error al cargar directorio de chat:", error);
    }
  };

  const seleccionarContactoParaChat = async (contacto) => {
    if (!miPerfil || !contacto?.uid) return;
    const nuevoChatId = generarChatId(myuid, contacto.uid);

    const snapChat = await get(ref(db, `chats/${nuevoChatId}/info`));
    if (!snapChat.exists()) {
      const estadoInicial = esPx ? 'pendiente' : 'aceptado';
      const ahoraStr = new Date().toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const infoNueva = {
        chatId: nuevoChatId,
        participantes: {
          [myuid]: true,
          [contacto.uid]: true
        },
        datosParticipantes: {
          [myuid]: {
            uid: myuid,
            nombre: miPerfil.nombre,
            rol: miPerfil.rol,
            especialidad: miPerfil.especialidad || '',
            fotoperfil: miPerfil.fotoperfil || ''
          },
          [contacto.uid]: {
            uid: contacto.uid,
            nombre: contacto.nombre,
            rol: contacto.rol,
            especialidad: contacto.especialidad || '',
            fotoperfil: contacto.fotoperfil || ''
          }
        },
        estado: estadoInicial,
        iniciadoPor: myuid,
        aprobadorUid: esPx ? contacto.uid : '',
        esPacienteAsignado: true,
        ultimoMensaje: esPx ? 'Solicitud de conversación pendiente...' : 'Conversación iniciada',
        ultimaFecha: ahoraStr,
        timestamp: Date.now(),
        noLeidos: {
          [myuid]: 0,
          [contacto.uid]: 0
        }
      };

      await set(ref(db, `chats/${nuevoChatId}/info`), infoNueva);
    }

    setChatActivoId(nuevoChatId);
    setIsModalDirectorioOpen(false);
  };

  const esPacienteExternoNoAsignado = 
    esPersonalSalud && 
    otroParticipante.rol === 'px' && 
    otroUid && 
    !Boolean(misPacientesMap && misPacientesMap[otroUid]);

  const handleAgregarPacienteDesdeChat = async () => {
    if (!myuid || !otroUid || vigenciaVencida) return;
    const confirmar = window.confirm(`¿Deseas agregar a "${otroParticipante.nombre}" a tu lista de Mis Pacientes?`);
    if (!confirmar) return;
    try {
      await set(ref(db, `px/${myuid}/${otroUid}`), { uid: otroUid });
      await update(ref(db, `chats/${chatActivoId}/info`), { esPacienteAsignado: true });
      alert(`"${otroParticipante.nombre}" ahora forma parte de tus pacientes.`);
    } catch (e) {
      console.error("Error al agregar paciente:", e);
    }
  };

  // =========================================================================
  // MÓDULO PARA ENVIAR O GENERAR RECETAS / TRATAMIENTOS DESDE EL CHAT (MÉDICO)
  // =========================================================================
  const abrirModalRecetasDelPaciente = async () => {
    if (!esMedico || vigenciaVencida || !otroUid || otroParticipante.rol !== 'px') return;
    setIsModalRecetaChatOpen(true);
    setCargandoNotasPx(true);

    try {
      const snapVisitas = await get(ref(db, `visitamedica/${otroUid}`));
      if (snapVisitas.exists()) {
        const data = snapVisitas.val();
        const notasMedicas = Object.keys(data)
          .map((key) => ({ pid: key, ...data[key] }))
          .filter((item) => item.tipo === 'MEDICA' && (!item.oculto || item.uidg === myuid))
          .reverse();
        setNotasHistoricasPx(notasMedicas);
      } else {
        setNotasHistoricasPx([]);
      }
    } catch (error) {
      console.error("Error al cargar historial médico para el chat:", error);
    } finally {
      setCargandoNotasPx(false);
    }
  };

  // Construye el objeto completo de Receta Oficial (con firma, cédulas, alergias y últimos signos vitales del paciente)
  const construirObjetoRecetaOficial = async (notaBase) => {
    let datosPx = {};
    let alergiasTexto = 'Negadas';
    let ultimoSv = {};

    try {
      const [snapPx, snapAl, snapSv] = await Promise.all([
        get(ref(db, `usuarios/px/${otroUid}`)),
        get(ref(db, `alergias/${otroUid}`)),
        get(ref(db, `signosvitales/${otroUid}`))
      ]);

      if (snapPx.exists()) datosPx = snapPx.val();
      if (snapAl.exists()) {
        const lista = Object.values(snapAl.val()).map((a) => a.alergia).filter(Boolean);
        if (lista.length > 0) alergiasTexto = lista.join(', ');
      }
      if (snapSv.exists()) {
        const arr = Object.values(snapSv.val());
        ultimoSv = arr[arr.length - 1] || {};
      }
    } catch (e) {
      console.error("Error al reunir datos clínicos para receta en chat:", e);
    }

    const listaEsp = [];
    if (miPerfilCompletoMedico.especialidad1) {
      listaEsp.push({
        nombre: miPerfilCompletoMedico.especialidad1,
        cedula: miPerfilCompletoMedico.cedula_esp1,
        universidad: miPerfilCompletoMedico.universidad_esp1
      });
    }
    if (miPerfilCompletoMedico.especialidad2) {
      listaEsp.push({
        nombre: miPerfilCompletoMedico.especialidad2,
        cedula: miPerfilCompletoMedico.cedula_esp2,
        universidad: miPerfilCompletoMedico.universidad_esp2
      });
    }
    if (miPerfilCompletoMedico.especialidad3) {
      listaEsp.push({
        nombre: miPerfilCompletoMedico.especialidad3,
        cedula: miPerfilCompletoMedico.cedula_esp3,
        universidad: miPerfilCompletoMedico.universidad_esp3
      });
    }

    const edadCalc = calcularEdad(datosPx.fecha_nac || datosPx.fechanacimiento);

    return {
      nombreMedico: miPerfilCompletoMedico.nombre || miPerfilCompletoMedico.nombrecom || miPerfil?.nombre || 'Médico',
      universidad: miPerfilCompletoMedico.universidad || '',
      cedulaPartero: miPerfilCompletoMedico.cedula_partero || miPerfilCompletoMedico.cedula || '',
      especialidades: listaEsp,
      direccionMedico: miPerfilCompletoMedico.direccion || '',
      localidadMedico: miPerfilCompletoMedico.localidad || '',
      telefonoMedico: miPerfilCompletoMedico.num_cel || miPerfilCompletoMedico.celular || '',
      correoMedico: miPerfilCompletoMedico.correo || '',
      firmaMedico: miPerfilCompletoMedico.firma || '',
      nombrePx: datosPx.nombre || datosPx.nombrecom || otroParticipante.nombre || 'Paciente',
      edadPx: edadCalc,
      sexoPx: datosPx.sexo || '',
      alergiasPx: alergiasTexto,
      ta: ultimoSv.tas && ultimoSv.tad ? `${ultimoSv.tas}/${ultimoSv.tad}` : '',
      fc: ultimoSv.fc || '',
      temp: ultimoSv.temp || '',
      spo2: ultimoSv.spo2 || '',
      peso: ultimoSv.peso || '',
      talla: ultimoSv.talla || '',
      imc: ultimoSv.imc || '',
      folio: notaBase.pid || 'CHAT',
      fecha: notaBase.fecha || new Date().toLocaleDateString('es-MX'),
      diagnostico: notaBase.diagnostico || '',
      tratamiento: notaBase.tratamiento || ''
    };
  };

  // Compartir una nota o receta histórica directamente en el chat
  const handleCompartirNotaHistoricaEnChat = async (nota, comoTarjetaReceta = true) => {
    if (!chatActivoObj || !otroUid || vigenciaVencida) return;
    setEnviandoReceta(true);

    try {
      const ahoraStr = new Date().toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      if (!comoTarjetaReceta) {
        // Enviar solo como texto de indicaciones
        const textoIndicaciones = `📋 Indicaciones Médicas (${nota.fecha}):\n• Diagnóstico: ${nota.diagnostico}\n• Tratamiento:\n${nota.tratamiento}`;
        await handleEnviarMensaje(null, textoIndicaciones);
        setIsModalRecetaChatOpen(false);
        return;
      }

      const datosRecetaCompleta = await construirObjetoRecetaOficial(nota);
      const resumenChat = `📋 Receta Médica compartida: ${nota.diagnostico}`;

      const nuevoMsgRef = push(ref(db, `chats/${chatActivoId}/mensajes`));
      await set(nuevoMsgRef, {
        id: nuevoMsgRef.key,
        emisorUid: myuid,
        emisorNombre: miPerfil?.nombre || 'Médico',
        texto: resumenChat,
        esReceta: true,
        datosReceta: datosRecetaCompleta,
        fecha: ahoraStr,
        timestamp: Date.now(),
        leido: false,
        tipoSistema: false
      });

      const noLeidosActuales = chatActivoObj.noLeidos?.[otroUid] || 0;
      await update(ref(db, `chats/${chatActivoId}/info`), {
        ultimoMensaje: resumenChat,
        ultimaFecha: ahoraStr,
        timestamp: Date.now(),
        [`noLeidos/${otroUid}`]: noLeidosActuales + 1
      });

      await enviarNotificacionChat(
        otroUid,
        `📋 Receta de Dr(a). ${miPerfil?.nombre}`,
        `Te ha compartido tu receta e indicaciones para "${nota.diagnostico}".`,
        chatActivoId
      );

      setIsModalRecetaChatOpen(false);
    } catch (error) {
      console.error("Error al compartir receta histórica:", error);
      alert("No se pudo enviar la receta al chat.");
    } finally {
      setEnviandoReceta(false);
    }
  };

  // Generar una nueva receta en el momento desde el chat (y guardarla en el expediente del paciente)
  const handleGenerarYEnviarNuevaReceta = async (e) => {
    e.preventDefault();
    if (!chatActivoObj || !otroUid || vigenciaVencida) return;
    if (!nuevaRecetaForm.diagnostico.trim() || !nuevaRecetaForm.tratamiento.trim()) {
      return alert("Completa el Diagnóstico y el Plan / Tratamiento.");
    }

    setEnviandoReceta(true);
    try {
      const ahora = new Date();
      const fechaActual = ahora.toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

      let pidGenerado = `RX${Date.now().toString().slice(-5)}`;

      // Si dejó marcada la opción de guardar en el expediente del paciente (visitamedica/[otroUid])
      if (nuevaRecetaForm.guardarEnExpediente) {
        const nuevaVisitaRef = push(ref(db, `visitamedica/${otroUid}`));
        pidGenerado = nuevaVisitaRef.key;

        await set(nuevaVisitaRef, {
          pid: pidGenerado,
          uid: otroUid,
          uidg: myuid,
          Firma: miPerfil?.nombre || 'Médico',
          tipo: 'MEDICA',
          motivo: nuevaRecetaForm.motivo.trim() || 'Orientación y seguimiento por chat clínico',
          exploracion: 'Seguimiento médico a distancia mediante mensajería clínica interna.',
          diagnostico: nuevaRecetaForm.diagnostico.trim(),
          tratamiento: nuevaRecetaForm.tratamiento.trim(),
          pronostico: 'Bueno para la vida y la función',
          oculto: false,
          fecha: fechaActual,
          fechaISO: hoyISO
        });
      }

      const notaCreada = {
        pid: pidGenerado,
        fecha: fechaActual,
        diagnostico: nuevaRecetaForm.diagnostico.trim(),
        tratamiento: nuevaRecetaForm.tratamiento.trim()
      };

      const datosRecetaCompleta = await construirObjetoRecetaOficial(notaCreada);
      const resumenChat = `📋 Nueva Receta Médica: ${notaCreada.diagnostico}`;

      const nuevoMsgRef = push(ref(db, `chats/${chatActivoId}/mensajes`));
      await set(nuevoMsgRef, {
        id: nuevoMsgRef.key,
        emisorUid: myuid,
        emisorNombre: miPerfil?.nombre || 'Médico',
        texto: resumenChat,
        esReceta: true,
        datosReceta: datosRecetaCompleta,
        fecha: fechaActual,
        timestamp: Date.now(),
        leido: false,
        tipoSistema: false
      });

      const noLeidosActuales = chatActivoObj.noLeidos?.[otroUid] || 0;
      await update(ref(db, `chats/${chatActivoId}/info`), {
        ultimoMensaje: resumenChat,
        ultimaFecha: fechaActual,
        timestamp: Date.now(),
        [`noLeidos/${otroUid}`]: noLeidosActuales + 1
      });

      await enviarNotificacionChat(
        otroUid,
        `📋 Nueva Receta de Dr(a). ${miPerfil?.nombre}`,
        `Te ha enviado una nueva receta médica: "${notaCreada.diagnostico}".`,
        chatActivoId
      );

      setNuevaRecetaForm({
        motivo: 'Orientación y seguimiento por chat clínico',
        diagnostico: '',
        tratamiento: '',
        guardarEnExpediente: true
      });
      setIsModalRecetaChatOpen(false);
    } catch (error) {
      console.error("Error al generar y enviar receta en chat:", error);
      alert("Ocurrió un error al generar la receta.");
    } finally {
      setEnviandoReceta(false);
    }
  };

  // =========================================================================
  // ENVÍO DE MENSAJES ESTÁNDAR
  // =========================================================================
  const handleEnviarMensaje = async (e, textoOpcional = null) => {
    if (e) e.preventDefault();
    const contenido = (textoOpcional !== null ? textoOpcional : textoMensaje).trim();
    if (!contenido || !chatActivoObj || !myuid || !otroUid) return;

    if (vigenciaVencida && esPersonalSalud) {
      return alert("⛔ Modo de solo lectura: Tu vigencia está vencida y no puedes enviar mensajes.");
    }

    if (profesionalEnDescanso) {
      return alert("En este momento el profesional se encuentra en una pausa de actividades y no puede recibir mensajes.");
    }

    const misMensajesPrevios = mensajes.filter((m) => m.emisorUid === myuid && !m.tipoSistema);
    if (chatActivoObj.estado === 'pendiente' && chatActivoObj.iniciadoPor === myuid && misMensajesPrevios.length >= 1) {
      return alert("⏳ Tu primer mensaje ya fue enviado. Espera a que el profesional de salud acepte tu solicitud para seguir escribiendo.");
    }

    if (chatActivoObj.estado === 'rechazado') {
      return alert("Esta solicitud fue rechazada. Utiliza el botón 'Enviar nueva solicitud' si necesitas volver a intentar.");
    }

    if (chatActivoObj.estado === 'finalizado' && esPx) {
      return alert("El profesional de salud ha finalizado esta conversación.");
    }

    try {
      const ahora = new Date();
      const fechaStr = ahora.toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const nuevoMsgRef = push(ref(db, `chats/${chatActivoId}/mensajes`));
      await set(nuevoMsgRef, {
        id: nuevoMsgRef.key,
        emisorUid: myuid,
        emisorNombre: miPerfil?.nombre || 'Usuario',
        texto: contenido,
        fecha: fechaStr,
        timestamp: Date.now(),
        leido: false,
        tipoSistema: false
      });

      const noLeidosActuales = chatActivoObj.noLeidos?.[otroUid] || 0;

      await update(ref(db, `chats/${chatActivoId}/info`), {
        ultimoMensaje: contenido,
        ultimaFecha: fechaStr,
        timestamp: Date.now(),
        [`noLeidos/${otroUid}`]: noLeidosActuales + 1
      });

      setTextoMensaje('');

      let esAsignado = true;
      if (esPx) {
        const snapRel = await get(ref(db, `px/${otroUid}/${myuid}`));
        esAsignado = snapRel.exists();
        await update(ref(db, `chats/${chatActivoId}/info`), { esPacienteAsignado: esAsignado });
      }

      const esSolicitudPrimeraVez = chatActivoObj.estado === 'pendiente' && chatActivoObj.iniciadoPor === myuid;
      let tituloNotif = `💬 Mensaje de ${miPerfil?.nombre}`;
      let detalleNotif = contenido;

      if (esSolicitudPrimeraVez) {
        if (!esAsignado) {
          tituloNotif = `⚠️ Solicitud externa: ${miPerfil?.nombre} (No es tu paciente)`;
          detalleNotif = `No está en tu lista de pacientes, pero desea contactarse contigo: "${contenido}"`;
        } else {
          tituloNotif = `💬 Solicitud de tu paciente: ${miPerfil?.nombre}`;
          detalleNotif = `"${contenido}" — Ingresa al chat para Aceptar o Rechazar.`;
        }
      }

      await enviarNotificacionChat(otroUid, tituloNotif, detalleNotif, chatActivoId);
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
    }
  };

  // Eliminar un mensaje propio enviado en el chat
  const handleEliminarMiMensaje = async (msgItem) => {
    if (!chatActivoId || !msgItem?.id || msgItem.emisorUid !== myuid) return;
    if (vigenciaVencida && esPersonalSalud) {
      return alert("⛔ Modo de solo lectura: No puedes eliminar mensajes con vigencia vencida.");
    }

    const confirmar = window.confirm("¿Deseas eliminar este mensaje que enviaste?");
    if (!confirmar) return;

    try {
      await remove(ref(db, `chats/${chatActivoId}/mensajes/${msgItem.id}`));

      // Actualizar la vista previa del último mensaje en la barra lateral
      const restantes = mensajes.filter((m) => m.id !== msgItem.id);
      const ultimo = restantes.length > 0 ? restantes[restantes.length - 1] : null;

      await update(ref(db, `chats/${chatActivoId}/info`), {
        ultimoMensaje: ultimo ? ultimo.texto : 'Mensaje eliminado',
        ultimaFecha: ultimo ? ultimo.fecha : chatActivoObj.ultimaFecha
      });
    } catch (error) {
      console.error("Error al eliminar mensaje:", error);
      alert("No se pudo eliminar el mensaje.");
    }
  };

  const handleResponderSolicitud = async (decision) => {
    if (!chatActivoObj || !otroUid) return;
    if (vigenciaVencida) {
      return alert("⛔ Tu vigencia está vencida. No puedes aceptar ni gestionar solicitudes de chat.");
    }

    const nuevoEstado = decision === 'ACEPTAR' ? 'aceptado' : 'rechazado';
    const ahoraStr = new Date().toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const textoAviso = decision === 'ACEPTAR'
      ? `✅ ${miPerfil?.nombre} aceptó la solicitud. Ahora pueden comunicarse libremente.`
      : `✕ ${miPerfil?.nombre} rechazó la solicitud de mensajes en este momento.`;

    try {
      const msgSistemaRef = push(ref(db, `chats/${chatActivoId}/mensajes`));
      await set(msgSistemaRef, {
        id: msgSistemaRef.key,
        emisorUid: myuid,
        emisorNombre: 'Sistema',
        texto: textoAviso,
        fecha: ahoraStr,
        timestamp: Date.now(),
        leido: false,
        tipoSistema: true
      });

      const noLeidosOtro = chatActivoObj.noLeidos?.[otroUid] || 0;
      await update(ref(db, `chats/${chatActivoId}/info`), {
        estado: nuevoEstado,
        ultimoMensaje: textoAviso,
        ultimaFecha: ahoraStr,
        timestamp: Date.now(),
        [`noLeidos/${otroUid}`]: noLeidosOtro + 1
      });

      const tituloNotifPx = decision === 'ACEPTAR'
        ? `✅ Solicitud de Chat Aceptada`
        : `✕ Solicitud de Chat No Aceptada`;

      await enviarNotificacionChat(otroUid, tituloNotifPx, textoAviso, chatActivoId);
      setFiltroTab('ACTIVOS');
    } catch (error) {
      console.error("Error al responder solicitud de chat:", error);
    }
  };

  const handleReintentarSolicitudPx = async () => {
    if (!chatActivoObj || profesionalEnDescanso) return;
    const motivoNuevo = window.prompt("Escribe brevemente el motivo por el que deseas solicitar nuevamente comunicación con el profesional:");
    if (!motivoNuevo || !motivoNuevo.trim()) return;

    const ahoraStr = new Date().toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    try {
      const snapRel = await get(ref(db, `px/${otroUid}/${myuid}`));
      const esAsignado = snapRel.exists();

      const msgRef = push(ref(db, `chats/${chatActivoId}/mensajes`));
      await set(msgRef, {
        id: msgRef.key,
        emisorUid: myuid,
        emisorNombre: miPerfil?.nombre || 'Paciente',
        texto: motivoNuevo.trim(),
        fecha: ahoraStr,
        timestamp: Date.now(),
        leido: false,
        tipoSistema: false
      });

      const noLeidosOtro = chatActivoObj.noLeidos?.[otroUid] || 0;
      await update(ref(db, `chats/${chatActivoId}/info`), {
        estado: 'pendiente',
        iniciadoPor: myuid,
        aprobadorUid: otroUid,
        esPacienteAsignado: esAsignado,
        ultimoMensaje: motivoNuevo.trim(),
        ultimaFecha: ahoraStr,
        timestamp: Date.now(),
        [`noLeidos/${otroUid}`]: noLeidosOtro + 1
      });

      const tituloNotif = !esAsignado
        ? `⚠️ Solicitud externa: ${miPerfil?.nombre} (No es tu paciente)`
        : `💬 Solicitud de tu paciente: ${miPerfil?.nombre}`;
      const detalleNotif = !esAsignado
        ? `No está en tu lista de pacientes, pero desea contactarse contigo: "${motivoNuevo.trim()}"`
        : `"${motivoNuevo.trim()}" — Ingresa al chat para Aceptar o Rechazar.`;

      await enviarNotificacionChat(otroUid, tituloNotif, detalleNotif, chatActivoId);
    } catch (e) {
      console.error("Error al reintentar solicitud:", e);
    }
  };

  const handleCambiarEstadoConversacion = async (nuevoEstado) => {
    if (!chatActivoObj || vigenciaVencida) return;
    const ahoraStr = new Date().toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const textoSistema = nuevoEstado === 'finalizado'
      ? `🔒 El profesional ha finalizado esta consulta por chat.`
      : `🔓 El profesional ha reactivado la conversación.`;

    await update(ref(db, `chats/${chatActivoId}/info`), {
      estado: nuevoEstado,
      ultimoMensaje: textoSistema,
      ultimaFecha: ahoraStr,
      timestamp: Date.now()
    });

    const msgRef = push(ref(db, `chats/${chatActivoId}/mensajes`));
    await set(msgRef, {
      id: msgRef.key,
      emisorUid: myuid,
      emisorNombre: 'Sistema',
      texto: textoSistema,
      fecha: ahoraStr,
      timestamp: Date.now(),
      leido: false,
      tipoSistema: true
    });
  };

  const solicitudesPendientesParaMi = chats.filter(
    (c) => c.estado === 'pendiente' && c.aprobadorUid === myuid
  );

  const chatsFiltrados = chats.filter((c) => {
    const otroId = c.participantes ? Object.keys(c.participantes).find((u) => u !== myuid) : '';
    const infoOtro = c.datosParticipantes?.[otroId] || {};
    const coincideTexto = !busquedaChat || 
      (infoOtro.nombre || '').toLowerCase().includes(busquedaChat.toLowerCase());

    if (!coincideTexto) return false;

    if (!esPx && filtroTab === 'SOLICITUDES') {
      return c.estado === 'pendiente' && c.aprobadorUid === myuid;
    }
    return true;
  });

  const avatarPorDefecto = 'https://cdn-icons-png.flaticon.com/512/3774/3774299.png';

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '60px' }}>Cargando mensajería clínica...</div>;

  return (
    <div className="chat-page-container">
      
      {/* BANNER VIGENCIA VENCIDA (SOLO VISIBLE PARA EL PROFESIONAL LOGUEADO) */}
      {vigenciaVencida && esPersonalSalud && (
        <div className="chat-banner-vencido">
          <FaLock />
          <span>
            <strong>Modo Solo Lectura (Vigencia Vencida):</strong> Puedes consultar tu historial de mensajes, pero no puedes enviar mensajes, compartir recetas ni aceptar solicitudes nuevas.
          </span>
        </div>
      )}

      {/* BARRA SUPERIOR DE REGRESO */}
      <div className="chat-top-nav">
        <Link to={esPx ? `/px/${myuid}` : '/'} className="btn-volver-chat">
          <FaArrowLeft /> {esPx ? 'Regresar a mi menú' : 'Volver al Panel de Control'}
        </Link>

        <div className="chat-top-title">
          <FaComments style={{ color: '#3498db' }} />
          <span>Comunicación Interna</span>
        </div>

        {(!vigenciaVencida || esPx) && (
          <button onClick={abrirDirectorioContactos} className="btn-nuevo-chat">
            <FaPlus /> Nuevo Mensaje
          </button>
        )}
      </div>

      {/* CONTENEDOR PRINCIPAL DE CHAT EN 2 PANELES */}
      <div className="chat-main-box">
        
        {/* PANEL IZQUIERDO: LISTA DE CONVERSACIONES */}
        <aside className={`chat-sidebar ${chatActivoId ? 'ocultar-en-movil' : ''}`}>
          
          {!esPx && (
            <div className="chat-sidebar-tabs">
              <button 
                className={filtroTab === 'ACTIVOS' ? 'active' : ''} 
                onClick={() => setFiltroTab('ACTIVOS')}
              >
                Todos ({chats.length})
              </button>
              <button 
                className={filtroTab === 'SOLICITUDES' ? 'active' : ''} 
                onClick={() => setFiltroTab('SOLICITUDES')}
              >
                Solicitudes
                {solicitudesPendientesParaMi.length > 0 && (
                  <span className="badge-solicitudes-tab">{solicitudesPendientesParaMi.length}</span>
                )}
              </button>
            </div>
          )}

          <div className="chat-search-bar">
            <FaSearch style={{ color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar conversación..." 
              value={busquedaChat}
              onChange={(e) => setBusquedaChat(e.target.value)}
            />
          </div>

          <div className="chat-conv-list">
            {chatsFiltrados.length === 0 ? (
              <div className="chat-sidebar-empty">
                <p>
                  {filtroTab === 'SOLICITUDES' 
                    ? 'No tienes solicitudes pendientes por aprobar.' 
                    : 'Aún no tienes conversaciones activas.'}
                </p>
                {(!vigenciaVencida || esPx) && (
                  <button onClick={abrirDirectorioContactos} className="btn-iniciar-vacio">
                    <FaPlus /> {esPx ? 'Escribir a mis médicos' : 'Iniciar conversación'}
                  </button>
                )}
              </div>
            ) : (
              chatsFiltrados.map((item) => {
                const uidInterlocutor = item.participantes
                  ? Object.keys(item.participantes).find((u) => u !== myuid)
                  : '';
                const datosInter = item.datosParticipantes?.[uidInterlocutor] || {};
                const noLeidosMios = item.noLeidos?.[myuid] || 0;
                const esSeleccionado = item.chatId === chatActivoId;
                const noEsMiPx = esPersonalSalud && datosInter.rol === 'px' && !Boolean(misPacientesMap && misPacientesMap[uidInterlocutor]);

                return (
                  <div
                    key={item.chatId}
                    onClick={() => setChatActivoId(item.chatId)}
                    className={`chat-conv-item ${esSeleccionado ? 'conv-activa' : ''}`}
                  >
                    <img
                      src={datosInter.fotoperfil && datosInter.fotoperfil !== 'null' ? datosInter.fotoperfil : avatarPorDefecto}
                      alt={datosInter.nombre}
                      className="conv-avatar"
                      onError={(e) => { e.target.onerror = null; e.target.src = avatarPorDefecto; }}
                    />

                    <div className="conv-info">
                      <div className="conv-row-top">
                        <h4>{datosInter.nombre || 'Usuario'}</h4>
                        <span className="conv-time">{(item.ultimaFecha || '').split(',')[0]}</span>
                      </div>

                      {noEsMiPx && (
                        <span style={{
                          display: 'inline-block',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '6px',
                          marginBottom: '2px'
                        }}>
                          ⚠️ No es tu paciente
                        </span>
                      )}

                      <div className="conv-row-bottom">
                        <p className="conv-preview">
                          {item.estado === 'pendiente' && item.aprobadorUid === myuid && (
                            <span className="tag-estado-mini tag-pendiente">Solicitud • </span>
                          )}
                          {item.estado === 'rechazado' && (
                            <span className="tag-estado-mini tag-rechazado">Rechazado • </span>
                          )}
                          {item.ultimoMensaje || 'Sin mensajes'}
                        </p>

                        {noLeidosMios > 0 && (
                          <span className="conv-unread-badge">{noLeidosMios}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* PANEL DERECHO: VENTANA DE CONVERSACIÓN ACTIVA */}
        <section className={`chat-window ${!chatActivoId ? 'ocultar-en-movil' : ''}`}>
          {!chatActivoObj ? (
            <div className="chat-window-empty">
              <div className="empty-circle-icon">
                <FaComments />
              </div>
              <h3>Mensajería Clínica Segura</h3>
              <p>
                {esPx 
                  ? 'Selecciona uno de tus médicos asignados en "+ Nuevo Mensaje" o busca un especialista en "Buscar Profesional" para enviarle una solicitud.'
                  : 'Selecciona una conversación de la lista izquierda o inicia un nuevo chat con tus pacientes o colegas.'}
              </p>
            </div>
          ) : (
            <>
              {/* CABECERA DEL CHAT ACTIVO */}
              <div className="chat-window-header">
                <div className="chat-header-left">
                  <button 
                    type="button" 
                    onClick={() => setChatActivoId(null)} 
                    className="btn-volver-movil"
                  >
                    <FaArrowLeft />
                  </button>

                  <img
                    src={otroParticipante.fotoperfil && otroParticipante.fotoperfil !== 'null' ? otroParticipante.fotoperfil : avatarPorDefecto}
                    alt={otroParticipante.nombre}
                    className="header-avatar"
                    onError={(e) => { e.target.onerror = null; e.target.src = avatarPorDefecto; }}
                  />

                  <div>
                    <h3 className="header-name">{otroParticipante.nombre}</h3>
                    <span className="header-role">
                      {otroParticipante.rol === 'medico' && <><FaUserMd /> Médico {otroParticipante.especialidad ? `• ${otroParticipante.especialidad}` : ''}</>}
                      {otroParticipante.rol === 'enfermeria' && <><FaUserNurse /> Enfermería {otroParticipante.especialidad ? `• ${otroParticipante.especialidad}` : ''}</>}
                      {otroParticipante.rol === 'px' && (
                        <>
                          <FaUserInjured /> {esPacienteExternoNoAsignado ? 'Usuario Externo (No es tu paciente)' : 'Tu Paciente'}
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* ACCIONES RÁPIDAS DEL PERSONAL DE SALUD */}
                {!esPx && (
                  <div className="chat-header-actions">
                    {/* BOTÓN PARA COMPARTIR O GENERAR RECETA / TRATAMIENTO (Solo Médico con Vigencia Activa charlando con un Paciente) */}
                    {esMedico && !vigenciaVencida && otroParticipante.rol === 'px' && chatActivoObj.estado === 'aceptado' && (
                      <button 
                        type="button"
                        onClick={abrirModalRecetasDelPaciente} 
                        className="btn-header-action btn-receta-chat"
                        title="Enviar receta del historial o generar nuevo tratamiento"
                      >
                        <FaFilePrescription /> Receta / Tratamiento
                      </button>
                    )}

                    {otroParticipante.rol === 'px' && !esPacienteExternoNoAsignado && (
                      <button 
                        type="button"
                        onClick={() => navigate(`/px/${otroParticipante.uid}`)} 
                        className="btn-header-action"
                        title="Abrir expediente del paciente"
                      >
                        <FaFolderOpen /> Expediente
                      </button>
                    )}

                    {otroParticipante.rol === 'px' && esPacienteExternoNoAsignado && !vigenciaVencida && (
                      <button 
                        type="button"
                        onClick={handleAgregarPacienteDesdeChat} 
                        className="btn-header-action"
                        style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
                        title="Agregar a mi lista de pacientes"
                      >
                        <FaUserPlus /> Agregar a Mis Pacientes
                      </button>
                    )}

                    {!vigenciaVencida && chatActivoObj.estado === 'aceptado' && (
                      <button 
                        type="button"
                        onClick={() => handleCambiarEstadoConversacion('finalizado')} 
                        className="btn-header-action btn-pausar-chat"
                        title="Pausar o finalizar conversación"
                      >
                        <FaBan /> Finalizar
                      </button>
                    )}

                    {!vigenciaVencida && chatActivoObj.estado === 'finalizado' && (
                      <button 
                        type="button"
                        onClick={() => handleCambiarEstadoConversacion('aceptado')} 
                        className="btn-header-action btn-reactivar-chat"
                      >
                        <FaRedo /> Reactivar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* AVISO AL MÉDICO CUANDO EL PACIENTE NO ES SU PACIENTE ACTUAL */}
              {esPacienteExternoNoAsignado && (
                <div style={{
                  backgroundColor: '#fffbeb',
                  borderBottom: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FaExclamationCircle style={{ color: '#d97706', fontSize: '1rem', flexShrink: 0 }} />
                  <span>
                    <strong>Aviso:</strong> <em>{otroParticipante.nombre}</em> <strong>no es tu paciente actual</strong>, pero desea contactarse contigo a través del directorio profesional.
                  </span>
                </div>
              )}

              {/* AVISO SUTIL DE URGENCIAS PARA PACIENTES */}
              {esPx && (
                <div className="chat-disclaimer-px">
                  Este canal es para orientación y seguimiento. En caso de emergencia médica acuda de inmediato a urgencias.
                </div>
              )}

              {/* ÁREA DE MENSAJES */}
              <div className="chat-messages-area">
                {mensajes.length === 0 ? (
                  <div className="chat-no-messages-yet">
                    {esPx ? (
                      <p>Escribe tu primer mensaje abajo para enviar la solicitud de conversación a <strong>{otroParticipante.nombre}</strong>.</p>
                    ) : (
                      <p>Envía el primer mensaje para iniciar la conversación con <strong>{otroParticipante.nombre}</strong>.</p>
                    )}
                  </div>
                ) : (
                  mensajes.map((m) => {
                    if (m.tipoSistema) {
                      return (
                        <div key={m.id} className="msg-sistema-row">
                          <span>{m.texto}</span>
                        </div>
                      );
                    }

                    const esMio = m.emisorUid === myuid;

                    return (
                      <div key={m.id} className={`msg-row ${esMio ? 'msg-mio' : 'msg-otro'}`}>
                        <div className={`msg-bubble ${m.esReceta ? 'msg-bubble-receta' : ''}`}>
                          
                          {/* SI EL MENSAJE CONTIENE UNA TARJETA DE RECETA MÉDICA */}
                          {m.esReceta && m.datosReceta ? (
                            <div className="chat-receta-card">
                              <div className="chat-receta-header">
                                <FaFilePrescription className="chat-receta-icon" />
                                <div>
                                  <strong>Receta e Indicaciones Médicas</strong>
                                  <span>Folio: #{String(m.datosReceta.folio || '001').slice(-6).toUpperCase()} • {m.datosReceta.fecha}</span>
                                </div>
                              </div>

                              <div className="chat-receta-body">
                                <p><strong>Diagnóstico:</strong> {m.datosReceta.diagnostico}</p>
                                <div className="chat-receta-tratamiento">
                                  <strong>Plan / Tratamiento:</strong>
                                  <pre>{m.datosReceta.tratamiento}</pre>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setRecetaActivaPreview(m.datosReceta)}
                                className="btn-ver-receta-chat"
                              >
                                <FaPrint /> Ver / Imprimir Receta Oficial
                              </button>
                            </div>
                          ) : (
                            <p className="msg-text">{m.texto}</p>
                          )}

                        <div className="msg-meta">
                            <span>{m.fecha}</span>
                            {esMio && (
                              <>
                                <span className={`msg-check ${m.leido ? 'leido' : ''}`}>
                                  {m.leido ? <FaCheckDouble title="Leído" /> : <FaCheck title="Enviado" />}
                                </span>
                                {(!vigenciaVencida || esPx) && (
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarMiMensaje(m)}
                                    title="Eliminar este mensaje"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'rgba(255,255,255,0.85)',
                                      cursor: 'pointer',
                                      padding: '0 0 0 6px',
                                      fontSize: '0.74rem',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <FaTrashAlt />
                                  </button>
                                )}
                              </>
                            )}
                          </div>    
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={mensajesEndRef} />
              </div>

              {/* RESPUESTAS RÁPIDAS PARA EL MÉDICO / ENFERMERO */}
              {esPersonalSalud && !vigenciaVencida && !profesionalEnDescanso && chatActivoObj.estado === 'aceptado' && (
                <div className="chat-quick-replies">
                  {RESPUESTAS_RAPIDAS_PERSONAL.map((resp, idx) => (
                    <button 
                      key={idx} 
                      type="button" 
                      onClick={() => handleEnviarMensaje(null, resp)}
                      className="chip-quick-reply"
                    >
                      {resp}
                    </button>
                  ))}
                </div>
              )}

              {/* PIE DE VENTANA SEGÚN EL ESTADO DE LA SOLICITUD Y DISPONIBILIDAD DEL PROFESIONAL */}
              <div className="chat-window-footer">
                
                {/* CASO ESPECIAL DISCRETO: EL MÉDICO CON EL QUE HABLA EL USUARIO TIENE LA VIGENCIA VENCIDA ("EN DESCANSO") */}
                {profesionalEnDescanso ? (
                  <div className="estado-descanso-discreto-box">
                    <div className="descanso-icon-circle">
                      <FaLeaf />
                    </div>
                    <div>
                      <strong>{otroParticipante.nombre} no se encuentra disponible temporalmente</strong>
                      <p>
                        En este momento el profesional ha hecho una pausa en la recepción de mensajes por motivos de agenda y descanso profesional. Si requieres seguimiento oportuno, te sugerimos acudir a consulta presencial o contactar a otro especialista del directorio.
                      </p>
                    </div>
                  </div>
                ) : vigenciaVencida && esPersonalSalud ? (
                  /* CASO MÉDICO CON VIGENCIA VENCIDA */
                  <div className="estado-espera-px-box">
                    <FaLock />
                    <span>Tu cuenta se encuentra en modo solo lectura por vigencia vencida. No puedes enviar mensajes en el chat.</span>
                  </div>
                ) : chatActivoObj.estado === 'pendiente' && chatActivoObj.aprobadorUid === myuid ? (
                  /* CASO 1: EL PERSONAL DE SALUD RECIBE UNA SOLICITUD DE PRIMERA VEZ */
                  <div className="solicitud-decision-box">
                    <div className="solicitud-decision-text">
                      <strong>
                        Solicitud de primer contacto de {otroParticipante.nombre}{' '}
                        {esPacienteExternoNoAsignado && (
                          <span style={{ color: '#d97706' }}>(No es tu paciente, pero desea contactarse contigo)</span>
                        )}
                      </strong>
                      <p>
                        {mensajes.length > 0 
                          ? '¿Deseas aceptar esta solicitud para comunicarte libremente?' 
                          : 'El usuario ha abierto una solicitud de contacto.'}
                      </p>
                    </div>
                    <div className="solicitud-decision-buttons">
                      <button 
                        type="button" 
                        onClick={() => handleResponderSolicitud('ACEPTAR')} 
                        className="btn-aceptar-solicitud"
                      >
                        <FaCheckCircle /> Aceptar y conversar
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleResponderSolicitud('RECHAZAR')} 
                        className="btn-rechazar-solicitud"
                      >
                        <FaTimesCircle /> Rechazar
                      </button>
                    </div>
                  </div>
                ) : chatActivoObj.estado === 'pendiente' && chatActivoObj.iniciadoPor === myuid && mensajes.filter(m => m.emisorUid === myuid && !m.tipoSistema).length >= 1 ? (
                  /* CASO 2: EL PACIENTE YA ENVIÓ SU PRIMER MENSAJE Y ESTÁ ESPERANDO APROBACIÓN */
                  <div className="estado-espera-px-box">
                    <FaClock style={{ color: '#d97706', fontSize: '1.2rem', flexShrink: 0 }} />
                    <span>
                      Tu mensaje inicial fue enviado. En cuanto <strong>{otroParticipante.nombre}</strong> acepte tu solicitud, podrás escribir libremente.
                    </span>
                  </div>
                ) : chatActivoObj.estado === 'rechazado' ? (
                  /* CASO 3: LA SOLICITUD FUE RECHAZADA */
                  <div className="estado-rechazado-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FaTimesCircle style={{ color: '#dc2626', fontSize: '1.25rem', flexShrink: 0 }} />
                      <span>
                        {esPx 
                          ? `El profesional de salud (${otroParticipante.nombre}) rechazó la solicitud de mensajes en este momento.` 
                          : 'Has rechazado esta solicitud de mensajes.'}
                      </span>
                    </div>
                    {esPx ? (
                      <button type="button" onClick={handleReintentarSolicitudPx} className="btn-reintentar-solicitud">
                        Enviar nueva solicitud
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleResponderSolicitud('ACEPTAR')} className="btn-reintentar-solicitud">
                        Aceptar conversación ahora
                      </button>
                    )}
                  </div>
                ) : chatActivoObj.estado === 'finalizado' ? (
                  <div className="estado-espera-px-box">
                    <FaLock />
                    <span>Esta conversación ha sido marcada como finalizada por el profesional de salud.</span>
                  </div>
                ) : (
                  /* CASO ACTIVO: BARRA DE ESCRITURA + BOTÓN ACCESO RÁPIDO A RECETA */
                  <form onSubmit={handleEnviarMensaje} className="chat-input-form">
                    {esMedico && otroParticipante.rol === 'px' && chatActivoObj.estado === 'aceptado' && (
                      <button
                        type="button"
                        onClick={abrirModalRecetasDelPaciente}
                        className="btn-adjuntar-receta-input"
                        title="Compartir o generar Receta / Tratamiento"
                      >
                        <FaFilePrescription />
                      </button>
                    )}
                    <input
                      type="text"
                      placeholder={
                        chatActivoObj.estado === 'pendiente' && esPx
                          ? "Escribe tu primer mensaje de solicitud para el profesional..."
                          : "Escribe un mensaje..."
                      }
                      value={textoMensaje}
                      onChange={(e) => setTextoMensaje(e.target.value)}
                    />
                    <button type="submit" disabled={!textoMensaje.trim()} className="btn-send-msg">
                      <FaPaperPlane />
                    </button>
                  </form>
                )}

              </div>
            </>
          )}
        </section>

      </div>

      {/* =========================================================================
          MODAL: ENVIAR TRATAMIENTO DEL HISTORIAL O GENERAR NUEVA RECETA EN EL CHAT
         ========================================================================= */}
      {isModalRecetaChatOpen && (
        <div className="chat-modal-overlay" onClick={() => setIsModalRecetaChatOpen(false)}>
          <div className="chat-modal-content modal-receta-chat-box" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>
                <FaFilePrescription style={{ color: '#2980b9', marginRight: '8px' }} />
                Receta y Tratamiento para {otroParticipante.nombre}
              </h3>
              <button onClick={() => setIsModalRecetaChatOpen(false)} className="btn-close-modal">
                <FaTimes />
              </button>
            </div>

            <div className="receta-chat-tabs">
              <button
                type="button"
                className={tabRecetaChat === 'HISTORIAL' ? 'active' : ''}
                onClick={() => setTabRecetaChat('HISTORIAL')}
              >
                <FaHistory /> Compartir del Historial ({notasHistoricasPx.length})
              </button>
              <button
                type="button"
                className={tabRecetaChat === 'NUEVA' ? 'active' : ''}
                onClick={() => setTabRecetaChat('NUEVA')}
              >
                <FaNotesMedical /> Generar Nueva Receta / Nota
              </button>
            </div>

            <div className="receta-chat-modal-body">
              {tabRecetaChat === 'HISTORIAL' ? (
                cargandoNotasPx ? (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Cargando historial del paciente...</p>
                ) : notasHistoricasPx.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b' }}>
                    <p>Este paciente aún no tiene Notas Médicas registradas en su expediente.</p>
                    <button
                      type="button"
                      onClick={() => setTabRecetaChat('NUEVA')}
                      className="btn-nuevo-chat"
                      style={{ marginTop: '8px' }}
                    >
                      + Generar Nueva Receta Ahora
                    </button>
                  </div>
                ) : (
                  <div className="historial-notas-chat-list">
                    {notasHistoricasPx.map((nota) => (
                      <div key={nota.pid} className="item-nota-hist-chat">
                        <div className="item-nota-hist-top">
                          <strong>{nota.diagnostico || 'Sin diagnóstico'}</strong>
                          <span>{nota.fecha}</span>
                        </div>
                        <p className="item-nota-hist-tx">{nota.tratamiento}</p>
                        <small style={{ color: '#64748b', display: 'block', marginBottom: '8px' }}>
                          Médico: {nota.Firma}
                        </small>
                        <div className="item-nota-hist-actions">
                          <button
                            type="button"
                            disabled={enviandoReceta}
                            onClick={() => handleCompartirNotaHistoricaEnChat(nota, true)}
                            className="btn-compartir-receta-oficial"
                          >
                            <FaFilePrescription /> Enviar Receta Oficial (PDF)
                          </button>
                          <button
                            type="button"
                            disabled={enviandoReceta}
                            onClick={() => handleCompartirNotaHistoricaEnChat(nota, false)}
                            className="btn-compartir-solo-texto"
                          >
                            Enviar solo texto
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <form onSubmit={handleGenerarYEnviarNuevaReceta} className="form-nueva-receta-chat">
                  <div className="field-receta-chat">
                    <label>Motivo / Nota de Seguimiento</label>
                    <input
                      type="text"
                      value={nuevaRecetaForm.motivo}
                      onChange={(e) => setNuevaRecetaForm({ ...nuevaRecetaForm, motivo: e.target.value })}
                      placeholder="Ej. Seguimiento por chat clínico"
                    />
                  </div>

                  <div className="field-receta-chat">
                    <label>Diagnóstico *</label>
                    <input
                      type="text"
                      value={nuevaRecetaForm.diagnostico}
                      onChange={(e) => setNuevaRecetaForm({ ...nuevaRecetaForm, diagnostico: e.target.value })}
                      placeholder="Ej. Faringoamigdalitis aguda, Control de HTA..."
                      required
                    />
                  </div>

                  <div className="field-receta-chat">
                    <label>Plan de Manejo y Tratamiento (Rx) *</label>
                    <textarea
                      rows="4"
                      value={nuevaRecetaForm.tratamiento}
                      onChange={(e) => setNuevaRecetaForm({ ...nuevaRecetaForm, tratamiento: e.target.value })}
                      placeholder="Escribe los medicamentos, dosis, horario, duración y signos de alarma..."
                      required
                    />
                  </div>

                  <label className="check-guardar-exp">
                    <input
                      type="checkbox"
                      checked={nuevaRecetaForm.guardarEnExpediente}
                      onChange={(e) => setNuevaRecetaForm({ ...nuevaRecetaForm, guardarEnExpediente: e.target.checked })}
                    />
                    <span>Guardar también esta nota y receta en el expediente clínico del paciente (Visita Médica)</span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setIsModalRecetaChatOpen(false)}
                      className="btn-compartir-solo-texto"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={enviandoReceta}
                      className="btn-compartir-receta-oficial"
                    >
                      <FaPaperPlane /> {enviandoReceta ? 'Enviando...' : 'Generar y Enviar al Chat'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DIRECTORIO PARA INICIAR NUEVA CONVERSACIÓN */}
      {isModalDirectorioOpen && (
        <div className="chat-modal-overlay" onClick={() => setIsModalDirectorioOpen(false)}>
          <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>{esPx ? 'Mis Médicos y Personal Tratante' : 'Iniciar Nueva Conversación'}</h3>
              <button onClick={() => setIsModalDirectorioOpen(false)} className="btn-close-modal">
                <FaTimes />
              </button>
            </div>

            <div className="chat-modal-filters">
              <div className="chat-modal-search">
                <FaSearch style={{ color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder={esPx ? "Buscar entre mis médicos..." : "Buscar por nombre, especialidad o localidad..."}
                  value={busquedaDirectorio}
                  onChange={(e) => setBusquedaDirectorio(e.target.value)}
                />
              </div>

              {!esPx && (
                <div className="chat-modal-role-pills">
                  <button 
                    className={filtroRolDirectorio === 'TODOS' ? 'active' : ''} 
                    onClick={() => setFiltroRolDirectorio('TODOS')}
                  >
                    Todos
                  </button>
                  <button 
                    className={filtroRolDirectorio === 'px' ? 'active' : ''} 
                    onClick={() => setFiltroRolDirectorio('px')}
                  >
                    Mis Pacientes
                  </button>
                  <button 
                    className={filtroRolDirectorio === 'medico' ? 'active' : ''} 
                    onClick={() => setFiltroRolDirectorio('medico')}
                  >
                    Médicos
                  </button>
                  <button 
                    className={filtroRolDirectorio === 'enfermeria' ? 'active' : ''} 
                    onClick={() => setFiltroRolDirectorio('enfermeria')}
                  >
                    Enfermería
                  </button>
                </div>
              )}
            </div>

            <div className="chat-directorio-list">
              {directorioContactos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b' }}>
                  {esPx ? (
                    <>
                      <p style={{ marginBottom: '12px' }}>
                        Aún no estás asignado a la lista de ningún médico tratante.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalDirectorioOpen(false);
                          navigate('/buscar-profesional');
                        }}
                        style={{
                          backgroundColor: '#3498db', color: '#fff', border: 'none',
                          padding: '9px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        Ir a Buscar Profesional
                      </button>
                    </>
                  ) : (
                    <p>No se encontraron contactos disponibles.</p>
                  )}
                </div>
              ) : (
                directorioContactos
                  .filter((c) => {
                    const coincideRol = filtroRolDirectorio === 'TODOS' || c.rol === filtroRolDirectorio;
                    const t = busquedaDirectorio.toLowerCase();
                    const coincideTexto = !t ||
                      c.nombre.toLowerCase().includes(t) ||
                      (c.especialidad || '').toLowerCase().includes(t) ||
                      (c.localidad || '').toLowerCase().includes(t);
                    return coincideRol && coincideTexto;
                  })
                  .map((contacto) => (
                    <div
                      key={contacto.uid}
                      onClick={() => seleccionarContactoParaChat(contacto)}
                      className="directorio-item"
                    >
                      <img
                        src={contacto.fotoperfil && contacto.fotoperfil !== 'null' ? contacto.fotoperfil : avatarPorDefecto}
                        alt={contacto.nombre}
                        className="directorio-avatar"
                        onError={(e) => { e.target.onerror = null; e.target.src = avatarPorDefecto; }}
                      />
                      <div className="directorio-info">
                        <h4>{contacto.nombre}</h4>
                        <span>
                          {contacto.rolEtiqueta} • {contacto.especialidad}
                          {contacto.enDescanso && (
                            <em style={{ color: '#d97706', marginLeft: '6px' }}>(Fuera de línea temporalmente)</em>
                          )}
                        </span>
                      </div>
                      <span className="btn-seleccionar-contacto">Mensaje →</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL OFICIAL DE RECETA PARA VER E IMPRIMIR DESDE EL CHAT */}
      <ModalReceta
        isOpen={!!recetaActivaPreview}
        onClose={() => setRecetaActivaPreview(null)}
        datosReceta={recetaActivaPreview}
      />

    </div>
  );
};

export default ChatInterno;