#!/usr/bin/env python3
"""Build an AES-256 owner handoff. Password/key inputs stay outside the public repository."""
from pathlib import Path
from zipfile import ZipFile
import argparse,hashlib,json,os,re,secrets,subprocess,datetime
import pyzipper
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--credentials',type=Path,required=True)
parser.add_argument('--keystore',type=Path,required=True)
parser.add_argument('--access-file',type=Path,required=True)
parser.add_argument('--previous-access',type=Path)
args=parser.parse_args()
assert not args.access_file.resolve().is_relative_to(root), 'Password record must stay outside repository'
s=(root/'zaman/enhancements.js').read_text();version=re.search(r"APP_VERSION='([^']+)'",s)[1];code=int(re.search(r'APP_VERSION_CODE=(\d+)',s)[1])
credentials=json.loads(args.credentials.read_text());credentials.update(versionName=version,versionCode=code,keystorePath='private/keys/zaman-development.jks')
key=args.keystore.read_bytes();credentials['keystoreSha256']=hashlib.sha256(key).hexdigest();credentials['appleCredentialsIncluded']=False
fingerprint='6e1bb159b61451f7b4d10f7e97f5f7f6239fda52c28c55a2625071d88106c8ac'
env=os.environ.copy();env['OWNER_VERIFY_STORE_PASSWORD']=credentials['keystorePassword']
cert=subprocess.check_output([str(Path(os.environ['JAVA_HOME'])/'bin/keytool'),'-exportcert','-keystore',str(args.keystore),'-alias',credentials['keyAlias'],'-storepass:env','OWNER_VERIFY_STORE_PASSWORD'],env=env,stderr=subprocess.DEVNULL)
assert hashlib.sha256(cert).hexdigest()==fingerprint
entries={}
def put(name,data):
    assert name not in entries
    entries[name]=data.encode() if isinstance(data,str) else data
source=root/'downloads'/f'ali-mirza-time-source-{version}.zip'
with ZipFile(source) as z:
    prefix=f'ali-mirza-time-{version}/'
    for name in z.namelist():
        if name.startswith(prefix+'zaman/'):
            relative=name[len(prefix):];data=z.read(name);assert data==(root/relative).read_bytes(),relative;put('project/'+relative,data)
for name in [f'zaman-android-{version}.apk',f'zaman-android-{version}-bazaar.apk',f'zaman-android-{version}.sha256',f'zaman-android-{version}-bazaar.sha256']:
    put('project/downloads/'+name,(root/'downloads'/name).read_bytes())
for p in (root/'downloads/bazaar-assets-1.12.3').glob('*'):
    if p.is_file():put('project/downloads/bazaar-assets-1.12.3/'+p.name,p.read_bytes())
put('HANDOFF.fa.md',(root/'zaman/HANDOFF.fa.md').read_bytes())
put('START-HERE.fa.txt',f'''مدیریت زمان علی میرزا — {version} / کد {code}
ابتدا HANDOFF.fa.md و project/zaman/MAINTENANCE.fa.md را بخوانید.
سورس و منابع در project/zaman و APKها در project/downloads هستند.
کلید اصلی در private/keys و رمزها و alias در private/CREDENTIALS.json هستند.
برای ساخت مستقل JDK21/SDK35 را نصب و build-owner-release.sh را اجرا کنید.
کد انتشار بعدی باید بزرگ‌تر از {code} باشد؛ شناسه و گواهی امضا را حفظ کنید.
پروژهٔ iOS در project/zaman/ios است و به Mac/Xcode و گواهی اپل نیاز دارد؛ IPA امضاشده نیست.
اطلاعات واقعی گوشی در این ZIP نیست؛ پشتیبان JSON را از خود برنامه جداگانه بگیرید.
رمز حساب GitHub، بازار یا Apple در اختیار پروژه نیست. کلید و رمزها را عمومی نکنید.
''')
put('project/.gitignore','zaman/android/build/\nzaman/ios/build/\n**/__pycache__/\nnode_modules/\n*.jks\n*.keystore\n.env\n')
put('private/keys/zaman-development.jks',key)
put('private/CREDENTIALS.json',json.dumps(credentials,ensure_ascii=False,indent=2)+'\n')
if args.previous_access:put('private/previous-backup-access.json',args.previous_access.read_bytes())
put('build-owner-release.sh','''#!/usr/bin/env bash
set -euo pipefail
BACKUP_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
export ZAMAN_SIGNING_DIR="$BACKUP_ROOT/private/keys"
export ZAMAN_STORE_PASSWORD="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["keystorePassword"])' "$BACKUP_ROOT/private/CREDENTIALS.json")"
export ZAMAN_KEY_PASSWORD="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["keyPassword"])' "$BACKUP_ROOT/private/CREDENTIALS.json")"
export ZAMAN_KEY_ALIAS="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["keyAlias"])' "$BACKUP_ROOT/private/CREDENTIALS.json")"
: "${JAVA_HOME:?Set JAVA_HOME to JDK21}"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT}"
: "${ANDROID_BUILD_TOOLS:?Set ANDROID_BUILD_TOOLS}"
cd "$BACKUP_ROOT/project"
ZAMAN_CHANNEL=bazaar bash zaman/android/build.sh
ZAMAN_CHANNEL=direct bash zaman/android/build.sh
python3 zaman/scripts/prepare-release.py
''')
qa=Path(os.environ.get('ZAMAN_QA_REPORT',f'/tmp/zaman-tests-{version}.json'))
if qa.exists():
    results=json.loads(qa.read_text());assert all(r['code']==0 for r in results), 'Fix failed tests before owner backup'
    put('QA-RESULTS.json',qa.read_bytes())
date=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip() if (root/'.git').exists() else 'source archive'
manifest={'versionName':version,'versionCode':code,'sourceBaseCommit':commit,'date':date,'encryption':'AES-256','personalPhoneDataIncluded':False,'appleSigningCredentialsIncluded':False,'files':[{'path':name,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in sorted(entries.items())]}
put('FILE-MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
password='AM-'+secrets.token_urlsafe(24)
out=root/'downloads'/f'ali-mirza-complete-backup-{version}-{date}.zip'
with pyzipper.AESZipFile(out,'w',compression=pyzipper.ZIP_DEFLATED,encryption=pyzipper.WZ_AES,compresslevel=9) as z:
    z.setpassword(password.encode());z.setencryption(pyzipper.WZ_AES,nbits=256)
    for name,data in sorted(entries.items()):z.writestr('ali-mirza-complete-backup/'+name,data)
assert out.stat().st_size<32*1024*1024
with pyzipper.AESZipFile(out) as z:
    z.setpassword(password.encode());assert z.testzip() is None
    for info in z.infolist():
        assert info.flag_bits&1 and info.wz_aes_strength==3
        assert z.read(info.filename)==entries[info.filename.split('/',1)[1]]
with pyzipper.AESZipFile(out) as z:
    z.setpassword(b'wrong-password-test')
    try:z.read('ali-mirza-complete-backup/START-HERE.fa.txt')
    except RuntimeError:pass
    else:raise AssertionError('Wrong archive password accepted')
digest=hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix('.zip.sha256').write_text(digest+'  '+out.name+'\n')
args.access_file.parent.mkdir(parents=True,exist_ok=True)
args.access_file.write_text(json.dumps({'filename':out.name,'password':password,'sha256':digest,'bytes':out.stat().st_size,'files':len(entries)},indent=2)+'\n');args.access_file.chmod(0o600)
out.chmod(0o644);out.with_suffix('.zip.sha256').chmod(0o644)
print(f'PASS AES-256 owner backup: {out.name}, {len(entries)} verified files, {out.stat().st_size} bytes; password record saved privately')
