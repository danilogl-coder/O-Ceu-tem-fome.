/* Direção do trânsito em coordenadas da estrada. Sem DOM, desenho ou relógio real.
   z/velocidade são unidades da pista; off/largura são frações da meia-pista.
   Cada passo percebe uma fotografia comum antes de aplicar qualquer decisão. */
(function (root) {
  'use strict';
  const PASSO = 1 / 60;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PERFIS = {
    cauteloso: {intervalo: 1.65, reacao: .85, ritmo: .9, ganho: 500},
    comum: {intervalo: 1.2, reacao: .6, ritmo: 1, ganho: 350},
    apressado: {intervalo: .9, reacao: .4, ritmo: 1.1, ganho: 220}
  };
  function criar({carros, via, comprimento, condicoes = {}, segmentoEm = () => null,
    medidas = () => ({}), escala = 4.7458, escalaLateralContato = 1, semente = 1, aoContato = () => {}}) {
    let seed = semente >>> 0, tempo = 0, acumulado = 0, decisao = 0, proximoId = 1;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const wrap = z => ((z % comprimento) + comprimento) % comprimento;
    const distancia = (a, b) => { const d = wrap(b - a); return d > comprimento / 2 ? d - comprimento : d; };
    const aderencia = Math.max(.3, condicoes.aderencia || 1);
    const visibilidade = condicoes.neblina?.curta ? 9500 : condicoes.farois ? 21000 : 38000;
    const memoriaContatos = new Map();
    const faixas = c => c.sentido < 0 ? via.contra : via.nossas;
    // A direita é relativa ao sentido de marcha, inclusive na pista oposta.
    const direita = c => c.sentido > 0 ? Math.max(...faixas(c)) : Math.min(...faixas(c));
    const dimensoes = c => {
      const m = medidas(c.modelo) || {};
      const largura = via.largura * (m.W || 118) / 118;
      // A folga usada pela direção não é lataria. A integração informa a escala
      // lateral efetivamente desenhada, sem encurtar a antecipação da IA.
      return {largura, larguraContato: largura * escalaLateralContato, comprimento: (m.L || 312) * escala};
    };
    function iniciar(c) {
      if (c.ia) return;
      const r = random(), perfil = r < .25 ? 'cauteloso' : r < .85 ? 'comum' : 'apressado';
      c.sentido = c.sentido || (c.contramao ? -1 : 1);
      c.alvo = c.alvo ?? c.off;
      c.vOrig = c.vOrig ?? c.velocidade;
      c.dano = c.dano || 0;
      c.ia = {id: proximoId++, perfil, ...PERFIS[perfil], variacao: .96 + random() * .08,
        estado: 'cruzeiro', motivo: 'pista livre', cooldown: 0, sinalAte: 0,
        origem: c.off, passando: null, manobra: null};
      Object.assign(c, dimensoes(c));
    }
    function foto(jogador) {
      carros.forEach(iniciar);
      const lista = carros.map(c => ({...c, ...dimensoes(c), ia: {...c.ia}, ref: c}));
      if (jogador) lista.push({...jogador, ...dimensoes(jogador), id: 'jogador', jogador: true,
        sentido: 1, alvo: jogador.intencao?.alvo ?? jogador.off,
        ia: {...PERFIS.comum, ritmo: 1, variacao: 1, ...(jogador.ia || {}), ...(jogador.intencao || {})}});
      return indexar(lista);
    }
    const meiaLargura = (a, b) => (a.largura + b.largura) / 2;
    const meiaExtensao = (a, b) => (a.comprimento + b.comprimento) / 2;
    const id = c => c.jogador ? 'jogador' : c.ia.id;
    function indexar(lista) {
      lista.sort((a, b) => a.z - b.z);
      lista.indices = new Map(lista.map((c, i) => [id(c), i]));
      lista.jogador = lista.find(c => c.jogador) || null;
      return lista;
    }
    function faixaJogador(c, alvo, p) {
      // Reserva de direção, nunca caixa de colisão: considera também a direção
      // que o jogador já começou a fazer, inclusive sob controle manual.
      const lateral = clamp((p.off - (p.anteriorOff ?? p.off)) / PASSO, -1.8, 1.8);
      const previsto = p.ia.manobra ? p.alvo : p.off + lateral * .45;
      const margem = meiaLargura(c, p) + .10;
      const min = Math.min(p.off, previsto) - margem, max = Math.max(p.off, previsto) + margem;
      return (alvo > min && alvo < max) ||
        (c.off < min && alvo > max) || (c.off > max && alvo < min);
    }
    function fecharJogador(c, alvo, lista, horizonte = 3) {
      const p = lista.jogador || lista.find(o => o.jogador);
      if (!p || c.jogador || !faixaJogador(c, alvo, p)) return false;
      const d = distancia(c.z, p.z), depois = d + (p.velocidade - c.velocidade) * Math.max(3, horizonte);
      const margem = meiaExtensao(c, p) + 350 + Math.abs(p.velocidade) * .9;
      return Math.min(d, depois) < margem && Math.max(d, depois) > -margem;
    }
    function prioridadeJogador(c, lista) {
      const p = lista.jogador;
      if (!p || c.jogador) return {ativa: false, limite: Infinity};
      const d = distancia(c.z, p.z) * c.sentido;
      const alinhado = faixaJogador(c, c.off, p);
      const gap = Math.abs(d) - meiaExtensao(c, p);
      const speed = Math.abs(c.velocidade), vp = p.velocidade * c.sentido;
      const vindoAtras = c.sentido > 0 && d < 0 && vp > speed + 150 && gap < (vp - speed) * 4.5 + 500;
      const frontal = c.sentido < 0 && d > 0 && gap < (speed - vp) * 4.5 + 500;
      let limite = Infinity;
      if (alinhado && d > 0) {
        // Pode parar por completo. O jogador ganha mais espaço e reação mais
        // cedo que um NPC, sem modificar sua física, dano ou controles.
        const segura = Math.max(0, vp + Math.max(0, gap - 350) / 2.2);
        if (segura < speed) limite = Math.max(-5100 * aderencia, (segura - speed) / .6);
      }
      return {ativa: alinhado && (limite < 0 || vindoAtras || frontal), limite,
        sair: alinhado && (vindoAtras || frontal), vindoAtras, frontal};
    }
    function frente(c, lista, off = c.off) {
      const indice = lista.indices.get(id(c));
      for (let passo = 1; passo < lista.length; passo++) {
        const o = lista[(indice + passo * c.sentido + lista.length) % lista.length];
        const d = distancia(c.z, o.z) * c.sentido;
        if (d < 0) break;
        // Durante a mudança, o carro ocupa também o corredor que está entrando.
        const ocupa = Math.abs(o.off - off) < meiaLargura(c, o) + .035 ||
          (o.ia.manobra && Math.abs(o.alvo - off) < meiaLargura(c, o) + .035);
        if (!ocupa) continue;
        if (d === 0) continue;
        const gap = d - meiaExtensao(c, o);
        return {carro: o, espaco: gap};
      }
      return {carro: null, espaco: Infinity};
    }
    function corredor(c, alvo, lista, horizonte = 2.5) {
      if (fecharJogador(c, alvo, lista, horizonte)) return false;
      for (const o of lista) {
        if (id(o) === id(c)) continue;
        const margem = meiaLargura(c, o) + .06;
        if (Math.abs(o.off - alvo) >= margem && !(o.ia.manobra && Math.abs(o.alvo - alvo) < margem)) continue;
        const d = distancia(c.z, o.z) * c.sentido;
        const dv = (o.velocidade - c.velocidade) * c.sentido;
        const fim = d + dv * horizonte;
        const livre = meiaExtensao(c, o) + 180;
        // Testa o intervalo inteiro: um carro rápido atrás não pode cruzar o vão.
        if (Math.min(d, fim) < livre && Math.max(d, fim) > -livre) return false;
        if (d > 0 && d < livre + Math.abs(c.velocidade) * .55) return false;
        if (d < 0 && -d < livre + Math.abs(o.velocidade) * .55) return false;
      }
      return true;
    }
    function trecho(c, alcance) {
      let curva = 0, proibido = false, subida = false;
      const limite = Math.min(alcance, comprimento / 2);
      for (let d = 0; d <= limite; d += 200) {
        const s = segmentoEm(wrap(c.z + c.sentido * d));
        if (!s) continue;
        curva = Math.max(curva, Math.abs(s.curva || 0));
        if (s.evento && ['cruzamento', 'entroncamento', 'nivel', 'ponte'].includes(s.evento.tipo || s.evento.id)) proibido = true;
        const inclinacao = ((s.p2?.mundo.y || 0) - (s.p1?.mundo.y || 0)) * c.sentido;
        if (inclinacao > 3) subida = true;
        if (subida && inclinacao < -1) proibido = true;
      }
      return {curva, proibido};
    }
    function velocidadeLivre(c) {
      if (c.dano >= 90) return 0;
      const adiante = trecho(c, Math.max(1800, Math.abs(c.velocidade) * 2));
      const curva = 1 / Math.sqrt(1 + adiante.curva * .1 / aderencia);
      const clima = Math.sqrt(aderencia) * (condicoes.neblina?.curta ? .72 : condicoes.farois ? .9 : 1);
      return Math.abs(c.vOrig) * c.ia.ritmo * c.ia.variacao * curva * clima * Math.max(.35, 1 - c.dano * .006);
    }
    function comando(c, lista, alvo = c.off) {
      const m = medidas(c.modelo) || {}, speed = Math.abs(c.velocidade);
      const a = m.bicicleta ? 380 : m.moto ? 1400 : 1050;
      const b = 2300 * aderencia, emergencia = 5100 * aderencia;
      const livre = velocidadeLivre(c), f = frente(c, lista, alvo);
      let aceleracao = a * (1 - Math.pow(speed / Math.max(1, livre), 4));
      let urgente = false;
      if (f.carro) {
        const lider = f.carro.velocidade * c.sentido;
        const fechamento = speed - lider;
        const intervalo = (f.carro.jogador && !c.jogador ? Math.max(2.2, c.ia.intervalo) : c.ia.intervalo) /
          Math.sqrt(aderencia) * (condicoes.neblina?.curta ? 1.3 : 1);
        const desejado = (f.carro.jogador ? 350 : 160) + Math.max(0, speed * intervalo + speed * fechamento / (2 * Math.sqrt(a * b)));
        aceleracao -= a * Math.pow(desejado / Math.max(1, f.espaco), 2);
        const parar = Math.max(0, (speed * speed - Math.max(0, lider) ** 2) / (2 * emergencia));
        urgente = f.espaco < 120 + parar + Math.max(0, fechamento) * .2;
      }
      // Lê até dois veículos além do líder: uma fila parando não deve ser
      // descoberta apenas quando o para-choque imediatamente à frente freia.
      let adiante = f.carro, previsao = null;
      for (let n = 0; n < 2 && adiante && adiante.sentido === c.sentido; n++) {
        adiante = frente(adiante, lista, alvo).carro;
        if (!adiante || id(adiante) === id(c) || adiante.sentido !== c.sentido) break;
        const d = distancia(c.z, adiante.z) * c.sentido;
        if (d <= 0 || d > visibilidade) break;
        const espaco = Math.max(0, d - meiaExtensao(c, adiante) - 160 - speed * c.ia.reacao);
        const segura = Math.sqrt(Math.abs(adiante.velocidade) ** 2 + 2 * b * .55 * espaco);
        const antecipada = (segura - speed) / 1.5;
        if (antecipada < 0 && antecipada < aceleracao) { aceleracao = antecipada; previsao = id(adiante); }
      }
      if (!livre) aceleracao = -b;
      return {aceleracao: clamp(aceleracao, urgente ? -emergencia : -b, a), urgente, frente: f, livre, previsao};
    }
    function vantagemFaixa(c, alvo, lista) {
      const livre = velocidadeLivre(c), horizonte = 6;
      const ritmo = off => {
        const f = frente(c, lista, off);
        if (!f.carro) return livre;
        return Math.min(livre, Math.max(0, f.carro.velocidade * c.sentido) +
          Math.max(0, f.espaco - Math.abs(c.velocidade) * c.ia.intervalo) / horizonte);
      };
      return ritmo(alvo) - ritmo(c.off) > c.ia.ganho * .5;
    }
    function memorizar(c, lista) {
      const ia = c.ia, lider = lista.find(o => id(o) === ia.passando);
      if (lider) {
        const avanco = distancia(lider.z, c.z) * c.sentido;
        if (ia.alvoMemoria !== ia.passando || avanco > (ia.melhorAvanco ?? -Infinity) + 100) {
          ia.alvoMemoria = ia.passando; ia.melhorAvanco = avanco; ia.progressoEm = tempo;
        }
      } else { ia.alvoMemoria = null; ia.progressoEm = tempo; }
      if (c.ref) Object.assign(c.ref.ia, {alvoMemoria: ia.alvoMemoria, melhorAvanco: ia.melhorAvanco, progressoEm: ia.progressoEm});
    }
    function cooperar(c, lista) {
      let limite = Infinity, motivo = '', solicitante = null;
      for (const o of lista) {
        if (id(o) === id(c) || o.sentido !== c.sentido) continue;
        const d = distancia(c.z, o.z) * c.sentido;
        if (Math.abs(d) > 9000 || Math.abs(c.off - o.off) < meiaLargura(c, o) * .6) continue;
        // Quem está sendo ultrapassado mantém o ritmo em vez de disputar a passagem.
        if (o.ia.passando === id(c) && limite > 0) { limite = 0; motivo = 'mantendo ritmo para facilitar ultrapassagem'; }
        const pedido = o.ia.pedidoFaixa ?? (o.ia.manobra ? o.alvo : null);
        if (pedido === null || Math.abs(pedido - c.off) > meiaLargura(c, o) + .06 || d <= meiaExtensao(c, o) * .35) continue;
        const desejado = meiaExtensao(c, o) + 250 + Math.abs(c.velocidade) * .8;
        if (d > desejado + 1000) continue;
        const ia = c.ia;
        if (ia.cedeId === id(o) && tempo >= ia.cedeAte) continue;
        if (ia.cedeId !== id(o) && tempo < (ia.cedeCooldown || 0)) continue;
        const alvoV = Math.max(0, Math.abs(o.velocidade) + (d - desejado) / 2.5);
        const desacelerar = clamp((alvoV - Math.abs(c.velocidade)) / 1.5, -700 * aderencia, 0);
        if (desacelerar < limite) { limite = desacelerar; motivo = 'abrindo espaço para outro motorista'; solicitante = id(o); }
      }
      if (solicitante !== null && c.ia.cedeId !== solicitante) {
        c.ia.cedeId = solicitante; c.ia.cedeAte = tempo + 4; c.ia.cedeCooldown = tempo + 7;
      }
      if (tempo >= (c.ia.cedeCooldown || 0) && solicitante === null) c.ia.cedeId = null;
      if (c.ref) Object.assign(c.ref.ia, {cedeId: c.ia.cedeId, cedeAte: c.ia.cedeAte, cedeCooldown: c.ia.cedeCooldown});
      return {limite, motivo, solicitante};
    }
    function podeUltrapassar(c, lider, lista) {
      if (!lider || lider.sentido !== c.sentido) return false;
      const vantagem = velocidadeLivre(c) - Math.abs(lider.velocidade);
      if (vantagem < c.ia.ganho) return false;
      const gap = distancia(c.z, lider.z) * c.sentido;
      const duracao = (gap + meiaExtensao(c, lider) + 300 + Math.abs(c.velocidade) * .6) / vantagem + 3.4;
      const alcance = Math.max(Math.abs(c.velocidade), velocidadeLivre(c)) * duracao;
      const estrada = trecho(c, Math.min(visibilidade, alcance));
      if (alcance > visibilidade || estrada.curva > 2.2 || estrada.proibido) return false;
      const alvo = c.sentido > 0 ? via.contra[0] : via.nossas[0];
      if (!corredor(c, alvo, lista, duracao)) return false;
      // Precisa haver um vão de retorno além do líder, não apenas contramão livre.
      const retorno = {...c, z: wrap(lider.z + c.sentido * (meiaExtensao(c, lider) + 350 + Math.abs(lider.velocidade) * .6))};
      return corredor(retorno, direita(c), lista.filter(o => id(o) !== id(lider)), 1.5);
    }
    function decidir(c, lista) {
      const ia = c.ia, home = direita(c), ctrl = comando(c, lista);
      const resultado = {estado: ctrl.frente.carro ? 'acompanhamento' : 'cruzeiro', motivo: ctrl.frente.carro ? 'mantendo distância do líder' : 'pista livre'};
      if (c.dano >= 90) return {...resultado, estado: 'recuperacao', motivo: 'veículo incapacitado', cancelar: true};
      if ((c.reagindo || 0) > 0) return {...resultado, estado: 'recuperacao', motivo: 'recuperando controle após impacto', cancelar: true};
      if (ia.manobra) return null;
      if (ia.passando !== null) {
        const lider = lista.find(o => id(o) === ia.passando);
        const passou = !lider || distancia(lider.z, c.z) * c.sentido > meiaExtensao(c, lider) + 250 + Math.abs(lider.velocidade) * .55;
        const perigo = !via.separada && lista.some(o => o.sentido !== c.sentido &&
          Math.abs(o.off - c.off) < meiaLargura(c, o) + .05 && distancia(c.z, o.z) * c.sentido > 0 &&
          distancia(c.z, o.z) * c.sentido < meiaExtensao(c, o) + (Math.abs(c.velocidade) + Math.abs(o.velocidade)) * 4);
        const semProgresso = tempo - (ia.progressoEm ?? tempo) > 6;
        const desistir = !passou && (semProgresso || (lider && Math.abs(lider.off - c.off) < meiaLargura(c, lider) && !lider.ia.manobra));
        const motivoRetorno = perigo ? 'abortando ultrapassagem por aproximação contrária' : desistir ? 'desistindo de ultrapassagem sem progresso' : 'ultrapassagem concluída';
        if ((passou || perigo || desistir) && corredor(c, home, lista)) return {alvo: home, estado: 'retorno', motivo: motivoRetorno};
        return {estado: perigo ? 'emergencia' : 'ultrapassagem', motivo: perigo ? 'freando para recuperar espaço de retorno' : passou || desistir ? 'aguardando espaço para retornar' : 'passando o veículo mais lento',
          abortar: perigo, pedidoFaixa: passou || perigo || desistir ? home : null};
      }
      if (Math.abs(c.off - home) > .05 && ia.cooldown <= tempo && corredor(c, home, lista))
        return {alvo: home, estado: 'retorno', motivo: 'retornando à direita'};
      const lider = ctrl.frente.carro;
      if (lider && ctrl.frente.espaco < Math.max(2400, Math.abs(c.velocidade) * 2.5) &&
          velocidadeLivre(c) - Math.max(0, lider.velocidade * c.sentido) > ia.ganho && ia.cooldown <= tempo) {
        const esquerda = faixas(c).find(f => (f - home) * c.sentido < 0);
        const alvo = via.separada ? esquerda : (c.sentido > 0 ? via.contra[0] : via.nossas[0]);
        if (alvo !== undefined && Math.abs(c.off - home) < .06 && corredor(c, alvo, lista) &&
            (via.separada ? vantagemFaixa(c, alvo, lista) : podeUltrapassar(c, lider, lista)))
          return {alvo, passando: id(lider), estado: 'mudanca', motivo: 'ultrapassagem com espaço previsto'};
        return {...resultado, estado: 'espera', motivo: 'aguardando espaço seguro para ultrapassar'};
      }
      return resultado;
    }
    function sinal(c, alvo) { return (alvo - c.off) * c.sentido < 0 ? 'esquerda' : 'direita'; }
    function aplicarDecisoes(lista) {
      const pedidos = lista.filter(c => !c.jogador).map(c => {
        memorizar(c, lista);
        const cooperacao = cooperar(c, lista);
        c.ref.ia.cooperacao = cooperacao;
        return {c, pedido: decidir(c, lista)};
      }).sort((a, b) => id(a.c) - id(b.c));
      const reservas = lista.filter(c => c.ia.manobra).map(c => ({...c, off: c.alvo}));
      for (const {c, pedido: p} of pedidos) {
        if (!p) continue;
        const real = c.ref, ia = real.ia;
        ia.pedidoFaixa = p.pedidoFaixa ?? null;
        if (p.alvo !== undefined) {
          if (!corredor(c, p.alvo, reservas, 3)) { ia.estado = 'espera'; ia.motivo = 'outro veículo reservou o vão'; continue; }
          ia.origem = c.off; ia.manobra = p.estado; ia.sinalAte = tempo + ia.reacao;
          ia.estado = 'sinalizacao'; ia.motivo = p.motivo;
          if (p.passando !== undefined) ia.passando = p.passando;
          real.alvo = p.alvo; real.seta = sinal(c, p.alvo);
          reservas.push({...c, off: p.alvo});
        } else {
          ia.estado = p.estado; ia.motivo = p.motivo; ia.abortar = !!p.abortar;
          if (p.cancelar) { ia.manobra = null; ia.passando = null; real.alvo = real.off; real.seta = null; }
        }
      }
    }
    function tick(jogador) {
      tempo += PASSO;
      const lista = foto(jogador);
      if (--decisao <= 0) { aplicarDecisoes(lista); decisao = 6; }
      // Inclui as intenções aprovadas neste passo, ainda ausentes da fotografia.
      const reservasPrioridade = lista.filter(c => !c.jogador && c.ref.ia.manobra)
        .map(c => ({...c, off: c.ref.alvo, alvo: c.ref.alvo}));
      for (const c of lista) {
        if (c.jogador) continue;
        const real = c.ref, ia = real.ia, antesV = Math.abs(c.velocidade);
        const prioridade = prioridadeJogador(c, lista);
        ia.prioridadeJogador = prioridade.ativa;
        if (ia.manobra && fecharJogador(c, real.alvo, lista) && Math.abs(c.off - ia.origem) < .15) {
          real.alvo = ia.origem; ia.manobra = null; ia.passando = null; real.seta = null;
          ia.cooldown = tempo + 2; ia.prioridadeJogador = true;
          ia.estado = 'prioridade'; ia.motivo = 'cancelando manobra para não fechar o jogador';
        }
        if (prioridade.sair && !ia.manobra && c.dano < 90 && !(c.reagindo > 0)) {
          const opcoes = faixas(c).filter(f => Math.abs(f - c.off) > .1)
            .sort((a, b) => Math.abs(a - direita(c)) - Math.abs(b - direita(c)));
          // Usa primeiro uma faixa legal; só recorre ao acostamento se houver
          // aproximação perigosa e espaço real para sair sem atravessar ninguém.
          const beira = via.separada ? (c.sentido > 0 ? 1 : via.contraCentro - 1) : c.sentido;
          if (Number.isFinite(beira)) opcoes.push(beira - Math.sign(beira) * (c.larguraContato / 2 + .02));
          const alvo = opcoes.find(f => !faixaJogador(c, f, lista.jogador) &&
            corredor(c, f, lista, 1.5) && corredor(c, f, reservasPrioridade, 1.5));
          if (alvo !== undefined) {
            ia.origem = c.off; real.alvo = alvo; ia.manobra = 'cedendo'; ia.passando = null;
            ia.cedendoJogador = true;
            ia.abortar = false; ia.sinalAte = tempo + .15; ia.cooldown = tempo + 3;
            real.seta = sinal(c, alvo); reservasPrioridade.push({...c, off: alvo});
          }
        }
        let ctrl = comando(c, lista);
        // Não abandona o freio enquanto está atravessando a faixa do líder.
        if (ia.manobra && tempo >= ia.sinalAte) {
          const futuro = comando(c, lista, real.alvo);
          if (futuro.aceleracao < ctrl.aceleracao) ctrl = futuro;
        }
        if (ia.abortar) ctrl.aceleracao = Math.min(ctrl.aceleracao, -2300 * aderencia);
        if (ia.cooperacao) ctrl.aceleracao = Math.min(ctrl.aceleracao, ia.cooperacao.limite);
        ctrl.aceleracao = Math.min(ctrl.aceleracao, prioridade.limite);
        ia.antecipando = ctrl.previsao;
        if (!ia.manobra && !ctrl.urgente && !real.reagindo && !real.alerta) {
          if (ctrl.previsao !== null) { ia.estado = 'antecipacao'; ia.motivo = 'reduzindo antes da fila adiante'; }
          else if (ia.cooperacao?.motivo && ia.cooperacao.limite <= 0) {
            ia.estado = 'cooperacao'; ia.motivo = ia.cooperacao.motivo;
          }
        }
        real.reagindo = Math.max(0, (real.reagindo || 0) - PASSO);
        real.alerta = real.dano >= 90;
        real.velocidade = Math.max(0, antesV + ctrl.aceleracao * PASSO) * c.sentido;
        if (antesV < 2 && real.dano >= 90) real.velocidade = 0;
        real.freando = ctrl.aceleracao < -90 || (Math.abs(real.velocidade) < 5 && !!ctrl.frente.carro);
        if (ctrl.urgente && !real.alerta && !real.reagindo) { ia.estado = 'emergencia'; ia.motivo = 'frenagem para evitar contato'; }
        real.guinada = (real.guinada || 0) * (1 - PASSO * 5);
        if (ia.manobra && tempo >= ia.sinalAte && !real.alerta) {
          const livre = corredor(c, real.alvo, lista, 1.2);
          const avancou = Math.abs(c.off - ia.origem) > .15;
          if (livre) {
            ia.estado = ia.manobra;
            const movimento = clamp(real.alvo - c.off, -.48 * PASSO, .48 * PASSO);
            real.off += movimento;
            real.guinada = movimento / PASSO;
            if (Math.abs(real.off - real.alvo) < .005) {
              real.off = real.alvo; ia.manobra = null; real.seta = null;
              if (ia.estado === 'retorno') { ia.passando = null; ia.abortar = false; ia.cooldown = tempo + 3; }
              ia.estado = ia.passando !== null ? 'ultrapassagem' : 'cruzeiro';
            }
          } else if (!avancou) {
            real.alvo = ia.origem; ia.manobra = null; ia.passando = null; ia.cooldown = tempo + 1;
            real.seta = null; ia.estado = 'espera'; ia.motivo = 'vão ocupado antes da manobra';
          } else {
            ia.estado = 'emergencia'; ia.motivo = 'espaço mudou durante a manobra';
            if (!prioridade.vindoAtras) {
              real.velocidade = c.sentido * Math.max(0, antesV - 5100 * aderencia * PASSO);
              real.freando = true;
            }
            if (corredor(c, ia.origem, lista, 1.2)) { real.alvo = ia.origem; ia.manobra = 'retorno'; real.seta = sinal(c, ia.origem); }
          }
        }
        // Desvio de emergência só diante de risco frontal e com acostamento livre.
        if (ctrl.urgente && ctrl.frente.carro?.sentido !== c.sentido && ctrl.frente.carro &&
            !via.separada && !ia.manobra && !real.alerta) {
          const beira = c.sentido * (1 - c.largura / 2 - .02);
          if (corredor(c, beira, lista, 1.5)) {
            real.alvo = beira; ia.origem = c.off; ia.manobra = 'emergencia'; ia.sinalAte = tempo;
            real.seta = sinal(c, beira); ia.cooldown = tempo + 2;
          }
        }
        real.z = wrap(c.z + real.velocidade * PASSO);
        if (ia.cedendoJogador && !ia.manobra && Math.abs(real.off - direita(c)) < .05)
          ia.cedendoJogador = false;
        if (ia.cedendoJogador && !ia.manobra && !real.alerta && !real.reagindo) {
          ia.estado = 'espera'; ia.motivo = 'aguardando espaço para retornar após ceder ao jogador';
        }
        if (ia.prioridadeJogador && !real.alerta && !real.reagindo) {
          ia.estado = 'prioridade';
          ia.motivo = prioridade.sair ? 'cedendo passagem ao jogador' : 'mantendo espaço para o jogador';
        }
        // Campos históricos continuam disponíveis aos consumidores do minigame.
        real.ultrapassando = ia.passando !== null ? 1 : 0;
        real.espera = Math.max(0, ia.cooldown - tempo);
        real.prox = ctrl.frente.carro ? 8 : 0;
        real.pertoV = ctrl.frente.carro?.velocidade || 0;
      }
      contatos(lista, jogador);
      for (const [chave, ate] of memoriaContatos) if (ate < tempo - 2) memoriaContatos.delete(chave);
    }
    function contatos(lista, jogador) {
      // Interseção contínua de dois retângulos varridos durante o passo.
      function intervalo(p, delta, raio) {
        if (Math.abs(delta) < 1e-9) return Math.abs(p) < raio ? [-Infinity, Infinity] : null;
        const a = (-raio - p) / delta, b = (raio - p) / delta;
        return [Math.min(a, b), Math.max(a, b)];
      }
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i], b = lista[j], ar = a.ref || jogador, br = b.ref || jogador;
        const az = a.jogador ? wrap(a.z - a.velocidade * PASSO) : a.z;
        const bz = b.jogador ? wrap(b.z - b.velocidade * PASSO) : b.z;
        const ax = a.jogador ? (a.anteriorOff ?? a.off) : a.off;
        const bx = b.jogador ? (b.anteriorOff ?? b.off) : b.off;
        const dx = bx - ax, dz = distancia(az, bz);
        const rz = meiaExtensao(a, b), rx = (a.larguraContato + b.larguraContato) / 2;
        // Descarte amplo antes dos testes contínuos: a maior parte da frota
        // está a quilômetros do par, sobretudo nas viagens longas da cidade.
        if (Math.abs(dz) > rz + (Math.abs(a.velocidade) + Math.abs(b.velocidade)) * PASSO + 5) continue;
        const ix = intervalo(dx, (br.off - bx) - (ar.off - ax), rx);
        const iz = intervalo(dz, distancia(bz, br.z) - distancia(az, ar.z), rz);
        if (!ix || !iz || Math.max(0, ix[0], iz[0]) > Math.min(1, ix[1], iz[1])) continue;
        const chave = [id(a), id(b)].sort().join(':');
        const impacto = Math.abs(a.velocidade - b.velocidade);
        if ((memoriaContatos.get(chave) || 0) <= tempo) {
          memoriaContatos.set(chave, tempo + 1.5);
          if (a.jogador || b.jogador) aoContato({carro: a.jogador ? br : ar, velocidade: impacto, frontal: a.sentido !== b.sentido});
          else {
            for (const r of [ar, br]) { r.dano = Math.min(100, r.dano + Math.max(2, impacto / 200)); r.reagindo = 1.5; }
          }
        }
        // Contato longitudinal conserva a faixa; não empurra carros para outra mão.
        const n = dz >= 0 ? 1 : -1;
        if (a.jogador || b.jogador) {
          const npc = a.jogador ? br : ar, player = a.jogador ? ar : br;
          const lado = a.jogador ? n : -n;
          npc.z = wrap(player.z + lado * (rz + 2));
          if (npc.sentido === 1) npc.velocidade = Math.min(Math.abs(npc.velocidade), Math.abs(player.velocidade));
          else npc.velocidade = 0;
        } else {
          const pen = Math.max(0, rz + 2 - distancia(ar.z, br.z) * n);
          ar.z = wrap(ar.z - n * pen / 2); br.z = wrap(br.z + n * pen / 2);
          const velocidade = a.sentido === b.sentido ? Math.min(Math.abs(ar.velocidade), Math.abs(br.velocidade)) : 0;
          ar.velocidade = velocidade * a.sentido; br.velocidade = velocidade * b.sentido;
        }
      }
    }
    function distribuir() {
      const postos = [];
      for (const c of carros) {
        iniciar(c);
        let livre = false;
        const folga = c.comprimento + 200 + Math.abs(c.velocidade) * c.ia.intervalo;
        for (let tentativas = 0; tentativas < Math.ceil(comprimento / 200); tentativas++) {
          if (postos.every(o => Math.abs(c.off - o.off) >= meiaLargura(c, o) + .05 || Math.abs(distancia(c.z, o.z)) > Math.max(folga, o.comprimento + 200 + Math.abs(o.velocidade) * o.ia.intervalo))) { livre = true; break; }
          c.z = wrap(c.z + 200);
        }
        if (livre) postos.push(c);
      }
      carros.splice(0, carros.length, ...postos);
    }
    // Piloto automático usa exatamente a mesma percepção e decisão dos NPCs.
    let auto = null;
    function orientar(jogador) {
      if (!auto) { auto = {...jogador, jogador: true, vOrig: jogador.vOrig, sentido: 1}; iniciar(auto); auto.ia = {...auto.ia, ...PERFIS.comum}; }
      Object.assign(auto, jogador, dimensoes(jogador));
      const lista = foto(null); lista.push({...auto, jogador: true}); indexar(lista);
      memorizar(auto, lista);
      const cooperacao = cooperar(auto, lista);
      const p = decidir(auto, lista), ctrl = comando(auto, lista);
      if (p) auto.ia.pedidoFaixa = p.pedidoFaixa ?? null;
      if (p?.alvo !== undefined && tempo >= auto.ia.sinalAte) {
        auto.ia.origem = auto.off;
        auto.alvo = p.alvo; auto.ia.manobra = p.estado; auto.ia.passando = p.passando ?? auto.ia.passando;
        auto.ia.sinalAte = tempo + auto.ia.reacao;
      }
      if (p?.estado) { auto.ia.estado = p.estado; auto.ia.motivo = p.motivo; auto.ia.abortar = !!p.abortar; }
      if (auto.ia.manobra && tempo >= auto.ia.sinalAte && !corredor(auto, auto.alvo, lista, 1.5)) {
        if (Math.abs(auto.off - auto.ia.origem) < .15) {
          auto.alvo = auto.ia.origem; auto.ia.manobra = null; auto.ia.passando = null; auto.ia.cooldown = tempo + 1;
        } else if (corredor(auto, auto.ia.origem, lista, 1.5)) {
          auto.alvo = auto.ia.origem; auto.ia.manobra = 'retorno'; auto.ia.abortar = true;
        }
      }
      if (auto.ia.manobra && Math.abs(auto.off - auto.alvo) < .05) {
        if (auto.ia.manobra === 'retorno') { auto.ia.passando = null; auto.ia.cooldown = tempo + 3; }
        auto.ia.manobra = null;
      }
      let alvo = auto.off;
      if (auto.ia.manobra && tempo >= auto.ia.sinalAte && corredor(auto, auto.alvo, lista, 1.5)) alvo = auto.alvo;
      else if (!auto.ia.manobra) alvo = auto.ia.passando !== null ? auto.alvo : auto.off;
      const seguro = comando(auto, lista, alvo);
      const aceleracao = Math.min(ctrl.aceleracao, seguro.aceleracao, cooperacao.limite, auto.ia.abortar ? -2300 * aderencia : Infinity);
      return {alvo, aceleracao,
        velocidade: Math.max(0, auto.velocidade + aceleracao * .25),
        intencao: {alvo: auto.alvo, manobra: auto.ia.manobra, passando: auto.ia.passando, pedidoFaixa: auto.ia.pedidoFaixa},
        bloqueado: !!ctrl.frente.carro, seta: auto.ia.manobra ? sinal(auto, auto.alvo) : null};
    }
    distribuir();
    return {passo: tick, avancar(dt, jogador) { acumulado += clamp(dt, 0, .25); while (acumulado + 1e-9 >= PASSO) { tick(jogador); acumulado -= PASSO; } },
      orientar, distancia, get tempo() { return tempo; },
      perceber(c, jogador) { iniciar(c); return frente({...c, ...dimensoes(c)}, foto(jogador)); },
      corredorLivre(c, alvo, jogador) { iniciar(c); return corredor({...c, ...dimensoes(c)}, alvo, foto(jogador)); }};
  }
  const api = {criar, PASSO, PERFIS};
  root.TransitoEstrada = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
