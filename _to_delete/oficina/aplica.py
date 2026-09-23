# Troca UMA funcao de icone dentro de mestre/ficha-pericias-arte.js,
# lendo o corpo novo de um arquivo solto. Assim o arquivo canonico fica
# no PC do Danilo e so o pedaco pequeno viaja.
import sys, os, io
base = os.path.dirname(os.path.abspath(__file__))
jogo = os.path.dirname(base)
alvo = os.path.join(jogo, 'mestre', 'ficha-pericias-arte.js')
nome = sys.argv[1]
novo = io.open(os.path.join(base, 'novo-%s.js' % nome), encoding='utf-8').read()
s = io.open(alvo, encoding='utf-8').read()
marca = '  A.%s = g => {' % nome
i0 = s.index(marca)
i1 = s.index('\n  };\n', i0) + len('\n  };\n')
if not novo.endswith('\n'): novo += '\n'
io.open(alvo, 'w', encoding='utf-8', newline='\n').write(s[:i0] + novo + s[i1:])
print('trocado:', nome, '| antes', i1-i0, 'bytes | agora', len(novo), 'bytes')
