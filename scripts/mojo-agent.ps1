param([ValidateSet('register','status')][string]$Action='status')
$ErrorActionPreference='Stop'
$credentialDirectory=Join-Path $env:LOCALAPPDATA 'AureumBlitz'
$credentialPath=Join-Path $credentialDirectory 'mojo-agent.dpapi'
$identityPath=Join-Path $credentialDirectory 'mojo-agent.json'

function Invoke-Mojo([string]$Path,[string]$Method='GET',[string]$Body='',[string]$Secret=''){
 if($Path -notin @('/api/agent/register','/api/agent/me')){throw 'Unsupported Mojo route'}
 $curlConfig=@('url = "https://mojo.devnads.com'+$Path+'"','request = "'+$Method+'"','header = "Content-Type: application/json"')
 if($Secret){$curlConfig+='header = "Authorization: Bearer '+$Secret+'"'}
 if($Body){$escapedBody=$Body.Replace('\','\\').Replace('"','\"').Replace("`n",'\n').Replace("`r",'\r');$curlConfig+='data = "'+$escapedBody+'"'}
 $response=($curlConfig -join "`n") | curl.exe --http1.1 --silent --show-error --fail --connect-timeout 15 --max-time 35 --config '-'
 if($LASTEXITCODE -ne 0){throw 'Mojo request failed; credentials were not printed. Check connectivity before retrying.'}
 return ($response -join "`n") | ConvertFrom-Json
}

if($Action -eq 'register'){
 if(Test-Path -LiteralPath $credentialPath){Get-Content -LiteralPath $identityPath;exit 0}
 $body=@{name='AUREUM Blitz Assistant';description='AUREUM creation-sharing project for Monad Blitz event 17.'}|ConvertTo-Json -Compress
 $registration=Invoke-Mojo '/api/agent/register' 'POST' $body
 if(!$registration.data.agentSecret){throw 'Registration did not return the required credential'}
 New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
 ConvertTo-SecureString $registration.data.agentSecret -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $credentialPath -Encoding utf8
 $publicIdentity=@{agentId=$registration.data.agentId;claimUrl=$registration.data.claimUrl}
 $publicIdentity|ConvertTo-Json|Set-Content -LiteralPath $identityPath -Encoding utf8
 $publicIdentity|ConvertTo-Json
}else{
 if(!(Test-Path -LiteralPath $credentialPath)){throw 'No agent credential exists. Run this script with -Action register first.'}
 $secure=Get-Content -LiteralPath $credentialPath -Raw | ConvertTo-SecureString
 $secret=[System.Net.NetworkCredential]::new('',$secure).Password
 try{$me=Invoke-Mojo '/api/agent/me' 'GET' '' $secret;$status=if($me.data){$me.data}else{$me};@{agentId=$status.agentId;status=$status.status;claimed=[bool]$status.claimedUser}|ConvertTo-Json}finally{$secret=$null}
}
