yarn build

$modules = "account","application","crypto","data-formats","hardware-ledger","hardware-wallet","networking","primitives","tx-parser","util"
#$modules = "application"

foreach ($module in $modules)
{
  echo "$module"
#  rm -r D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module
  rm -r D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module\src
  rm -r D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module\dist

  Copy-Item -Path D:\Develop\Radix\radixdlt-javascript\packages\$module\src -Destination D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module -recurse -Force
  Copy-Item -Path D:\Develop\Radix\radixdlt-javascript\packages\$module\dist -Destination D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module -recurse -Force
  if (test-path D:\Develop\Radix\radixdlt-javascript\packages\$module\test) {
    rm -r D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module\test
    Copy-Item -Path D:\Develop\Radix\radixdlt-javascript\packages\$module\test -Destination D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module -recurse -Force
  }
#  if (test-path D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module\node_modules) {
#    rm -r       D:\Develop\Radix\olympia-wallet\node_modules\@radixdlt\$module\node_modules
#  }
}



