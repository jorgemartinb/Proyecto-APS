import csv
import io
import zipfile
from pathlib import Path
from xml.etree import ElementTree

from django.db import transaction

from .models import Libro


CABECERAS = ['AUTOR/A', 'TÍTULO', 'EDITORIAL', 'CATEGORÍA', 'ISBN', 'ETIQUETA']

INVENTARIO_VALIDACION = """AUTOR/A;TÍTULO;EDITORIAL;CATEGORÍA;ISBN;ETIQUETA
Natividad Álvarez;Aportaciones a la cuestión femenina;Ediciones Akal;No ficción;978-84-7339-236-5;
Mona Chollet;Brujas;EDICIONES B, S.A.;Sociología;9788466665612;
Nuria Varela;Cansadas;B de bolsillo;Sociología;9788413141121;
Obra colectiva;Carnets de mujer;Editorial Argos Vergara;Ficción y no ficción;978-84-7178-332-5;
Moderna de Pueblo;Coñodramas;Zenith;Cómic;9788408233459;
Elena Favilli y Francesca Cavallo;Cuentos de buenas noches para niñas rebeldes;DESTINO;Infantil y humanidades;9780241709207;
Natza Farré i Maduell;Curso de feminismo para microondas;Now Books (sello de Ara Llibres);No ficción, ensayo sátirico, divulgación humorística y ensayo de género y sociología.;978-84-16245-64-2;
Maria Aurèlia Capmany;El feminismo ibñerico;Oikos-Tau;No ficción. Ensayo histórico-sociológico;978-84-281-0124-0;
María Hesse;El miedo;LUMEN;Novela gráfica, no ficción;9788426425577;
Simone de Beauvoir;El segundo sexo;Ediciones Cátedra;Sociología;9788437637365;
Nuria Varela;Feminismo 4.0. La cuarta ola.;B de bolsillo;No ficción;9788413148281;
Nuria Varela;Feminismo para principiantes;EDICIONES B, S.A.;Sociología;9788466665889;
Nerea Perez de las Heras;Feminismo para torpes;Ediciones Martínez Roca;Sociología;9788427045309;
Varios Aurores - Universidad de Córdoba;Feminismo.es… y será. Jornadas feministas, Córdoba 2000;Universidad de Córdoba;No ficción;9788478015856;
Júlia Salander;Fuego al machismo moderno;Montena;Ensayo político y social, estudios de género y feminismo;9788410298736;
María José Ragué Arias;Hablan las Women's Lib;Editorial Kairós;No ficción;978-84-7245-004-2;
Moderna de Pueblo;Idiotizadas;Zenith;Cómic;9788408265481;
Toti Martínez de Lezea;La comunera;MAEVA;Historia;9788496748057;
Alana S. Portero;La mala costumbre;Seix Barral;Novela contemporanea;9788432242120;
Betty Friedan;La mística de la feminidad;Ediciones Cátedra;Sociología;9788437636047;
Concepción Arenal;La mujer del porvenir;Editorial Castalia;No ficción, ensayo filosófico y social;978-84-7039-661-8;
Instituto de la mujer;La otra mitad de la ciencia;Instituto de la mujer;Material didáctico;;
Tomás Duplá;Laboralistas. Una década utópica;Bomarzo;No ficción;9788419574671;
María Hesse;Malas mujeres;LUMEN;Novela gráfica, no ficción;9788426409690;
María Colino;Margarita;Ediciones Sinsentido;Ficción y narrativa gráfica;978-84-95440-27-3;
Adela Muñoz Páez;Marie Curie;DEBATE;Biografía;9788417636807;
Varios Autores - Amnistía internacional;Mujeres al alba;Alfaguara;Sociología;9788420483849;
Maitena;Mujeres alteradas 2;Atlantida;Ficción y humor gráfico;9788426446121;
Ana Alemany;Mujeres de los mares;Ediciones del Viento, S.L.;Sociología;9788412055825;
Carlos Díez Polanco y Teresa Aguilar Larrucea;Mujeres fuertes/Mulheres fortes. Iberoamérica;Editorial Santillana;No ficción;978-84-294-9027-5;
Mujeres Creando;Mujeres grafiteando;Ediciones Mujeres Creando;No ficción;Edición independiente;
Xaro Nomdedeu Moreno;Mujeres, manzanas y matemáticas. Entretejidas;Nivola Libros y Ediciones;No ficción, ensayo histórico, de género y divulgación científica.;9788415913320;
Ana de Miguel;Neoliberalismo sexual;Ediciones Cátedra;Ensayo feminista;9788437634562;
María Milagros Rivera Garretas;Nombrar el mundo en femenino: Pensamiento de las mujeres y teoría feminista;Icaria Editorial;No ficción;978-84-7426-664-1;
Marjane Satrapi;Persépolis;RESERVOIR BOOKS;Novel gráfica;9788417910143;
Chimamanda Ngozi Adichie;Querida Ijeawele. o como educar en el feminismo;LITERATURA RANDOM HOUSE;Sociología;9788439732709;
Pamela Palenciano;Si es amor, no duele;Alfaguara;No ficción;978-84-204-8624-6;
Najat El Hachmi;Siempre han hablado por nosotras;DESTINO;Sociología;9788423356218;
Virginie Despentes;Teoría King Kong;LITERATURA RANDOM HOUSE;Sociología;9788439733997;
Chimamanda Ngozi Adichie;Todos deberíamos ser feministas;LITERATURA RANDOM HOUSE;Sociología;9788439731047;
Julia Salander;Tu argumentario feminista en datos;Montena;Politología y anáisis de datos;9788419848581;
Virginia Woolf;Una habitación propia;Austral;Ensayo feminista;9788432222825;
Reimunda de Peñafort;Una juez frente al maltrato;DEBATE;Historia y estudios;9788483066362;
Elisa Beni;Una mujer no muere jamás;Roca Editorial;Narrativa Española;9788418417306;
"""


def limpiar(valor):
    return '' if valor is None else str(valor).strip()


def filas_validacion():
    reader = csv.DictReader(io.StringIO(INVENTARIO_VALIDACION), delimiter=';')
    return [{key: limpiar(value) for key, value in row.items()} for row in reader]


def indice_columna(referencia):
    letras = ''.join(char for char in referencia if char.isalpha())
    indice = 0
    for char in letras:
        indice = indice * 26 + ord(char.upper()) - ord('A') + 1
    return indice - 1


def shared_strings(archivo):
    try:
        xml = archivo.read('xl/sharedStrings.xml')
    except KeyError:
        return []
    root = ElementTree.fromstring(xml)
    ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    return [''.join(t.text or '' for t in item.findall('.//x:t', ns)) for item in root.findall('x:si', ns)]


def ruta_hoja(archivo, nombre_hoja):
    workbook = ElementTree.fromstring(archivo.read('xl/workbook.xml'))
    rels = ElementTree.fromstring(archivo.read('xl/_rels/workbook.xml.rels'))
    ns = {
        'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
    }
    targets = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels.findall('rel:Relationship', ns)}
    for sheet in workbook.findall('x:sheets/x:sheet', ns):
        if sheet.attrib.get('name') == nombre_hoja:
            rel_id = sheet.attrib[f'{{{ns["r"]}}}id']
            target = targets[rel_id]
            return target if target.startswith('xl/') else f'xl/{target}'
    raise ValueError(f'No existe la hoja "{nombre_hoja}".')


def filas_excel(path, nombre_hoja='Hoja 1'):
    with zipfile.ZipFile(Path(path)) as archivo:
        strings = shared_strings(archivo)
        root = ElementTree.fromstring(archivo.read(ruta_hoja(archivo, nombre_hoja)))
        ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = []
        for row in root.findall('x:sheetData/x:row', ns):
            valores = [''] * 6
            for cell in row.findall('x:c', ns):
                idx = indice_columna(cell.attrib.get('r', 'A1'))
                if idx > 5:
                    continue
                inline = cell.find('x:is/x:t', ns)
                value = cell.find('x:v', ns)
                if inline is not None:
                    texto = inline.text or ''
                elif value is None:
                    texto = ''
                elif cell.attrib.get('t') == 's':
                    texto = strings[int(value.text)]
                else:
                    texto = value.text or ''
                valores[idx] = limpiar(texto)
            rows.append(valores)

    if not rows or rows[0] != CABECERAS:
        raise ValueError(f'Cabeceras inesperadas: {rows[0] if rows else []}')
    return [dict(zip(CABECERAS, row)) for row in rows[1:] if any(limpiar(celda) for celda in row)]


@transaction.atomic
def importar_filas(filas):
    creados = 0
    actualizados = 0
    for fila in filas:
        titulo = limpiar(fila.get('TÍTULO'))
        autor = limpiar(fila.get('AUTOR/A'))
        isbn = limpiar(fila.get('ISBN'))
        if not titulo:
            continue

        datos = {
            'titulo': titulo,
            'autor': autor,
            'editorial': limpiar(fila.get('EDITORIAL')),
            'categoria': limpiar(fila.get('CATEGORÍA')),
            'isbn': isbn or None,
            'etiqueta': limpiar(fila.get('ETIQUETA')) or None,
            'activo': True,
        }
        if isbn:
            _, creado = Libro.objects.update_or_create(isbn=isbn, defaults=datos)
        else:
            libro = Libro.objects.filter(titulo=titulo, autor=autor, isbn__isnull=True).first()
            if libro:
                for key, value in datos.items():
                    setattr(libro, key, value)
                libro.save()
                creado = False
            else:
                Libro.objects.create(**datos)
                creado = True

        creados += 1 if creado else 0
        actualizados += 0 if creado else 1
    return creados, actualizados
