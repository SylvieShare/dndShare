"""Shared deterministic helpers for the locally supplied PHB content."""
import copy, html, re, unicodedata

def norm(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value)).strip().casefold().replace('ё','е')

def unwrap(value):
    value = re.sub(r'(?<=\w)[-\u00ad]\s*\n\s*(?=\w)', '', value)
    return re.sub(r'\s+', ' ', value).strip().replace('\ufffd', '.')

def rich(blocks):
    out=[]
    for block in blocks:
        text=unwrap(block['text'])
        if not text:continue
        tag='h3' if block.get('kind')=='heading' else 'p'
        # Keep table rows readable. Source tables use 8pt Open Sans.
        if block.get('size')==8:
            text='<br>'.join(html.escape(unwrap(line)) for line in block['text'].splitlines())
        else:text=html.escape(text)
        out.append(f'<{tag}>{text}</{tag}>')
    return ''.join(out)

def flat(blocks):return '\n'.join(unwrap(b['text']) for b in blocks)
def ref(key):return {'$ref':key}
def key(kind,name):return 'phb2024:'+kind+':'+norm(name)

def sections(pages,start,end,size=13):
    result=[];current=None
    for page in range(start,end):
        for b in pages[page]:
            if b['kind']=='heading' and b['size']==size:
                current={'name':unwrap(b['text']),'page':page+1,'blocks':[]};result.append(current)
            elif current:
                if b['kind']=='heading' and b['size']>size:current=None
                else:current['blocks'].append(b)
    return result

class Catalogue:
    def __init__(self,items):self.items=items;self.records=[];self.decisions=[]
    def original(self,name,type_id,english=None):
        matches=[i for i in self.items if i['type_id']==type_id and (norm(i['name'])==norm(name) if not english else norm(i.get('name_en')or'')==norm(english))]
        if len(matches)>1:raise ValueError(f'Ambiguous original: {name}, {type_id}')
        return matches[0] if matches else None
    def add(self,kind,name,type_id,data,page,original=None,parent=None,status='none',note=None):
        record={'key':key(kind,name),'name':name,'nameEn':original.get('name_en') or '' if original else '',
          'typeId':type_id,'originalId':original['id'] if original else None,'data':data,'pdfPage':page,
          'automationStatus':status,'automationNote':note or 'Правила PHB 2024. Применение особенностей по описанию; автоматизация этой версии не настроена.'}
        if parent:record['parentKey']=parent
        data['edition_key']=record['key'];data['rules_source']=f'PHB 2024, стр. {page-1}'
        if any(r['key']==record['key'] for r in self.records):raise ValueError('Duplicate '+record['key'])
        self.records.append(record);return record
