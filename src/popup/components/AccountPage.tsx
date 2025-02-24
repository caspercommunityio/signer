import { observer } from 'mobx-react';
import React from 'react';
import AccountManager from '../container/AccountManager';
import { RouteComponentProps, withRouter } from 'react-router';
import { observable } from 'mobx';
import {
  CreateAccountFormData,
  ImportAccountFormData
} from '../container/ImportAccountContainer';
import ErrorContainer from '../container/ErrorContainer';
import {
  Button,
  createStyles,
  Theme,
  Typography,
  WithStyles,
  FormControl,
  Box,
  InputLabel
} from '@material-ui/core';
import { SelectFieldWithFormState, TextFieldWithFormState } from './Forms';
import withStyles from '@material-ui/core/styles/withStyles';
import { decodeBase16, decodeBase64, Keys } from 'casper-js-sdk';
import { KeyPairWithAlias } from '../../@types/models';
import Pages from './Pages';
import { confirm } from './Confirmation';

enum method {
  'Created',
  'Imported'
}

const styles = (theme: Theme) =>
  createStyles({
    root: {
      '& .MuiTextField-root': {
        marginTop: theme.spacing(2)
      }
    },
    importButton: {
      marginTop: theme.spacing(8)
    }
  });

interface Props extends RouteComponentProps, WithStyles<typeof styles> {
  authContainer: AccountManager;
  errors: ErrorContainer;
  action: 'Import' | 'Create';
}

interface State {
  keyDownloadEnabled: boolean;
  algoAnchorEl: HTMLButtonElement | null;
  revealSecretKey: boolean;
}

@observer
class AccountPage extends React.Component<Props, State> {
  @observable accountForm: ImportAccountFormData | CreateAccountFormData;

  constructor(props: Props) {
    super(props);
    if (props.action === 'Import') {
      this.accountForm = new ImportAccountFormData(props.errors);
    } else {
      this.accountForm = new CreateAccountFormData(props.errors);
    }
    this.state = {
      keyDownloadEnabled: false,
      algoAnchorEl: null,
      revealSecretKey: false
    };
  }

  async onCreateAccount() {
    const formData = this.accountForm as CreateAccountFormData;
    if (formData.submitDisabled) {
      return;
    }

    const names = this.props.authContainer.userAccounts.map(
      account => account.alias
    );
    if (names.includes(formData.name.$)) {
      return this.props.errors.capture(
        Promise.reject(
          new Error(`An account with name '${formData.name.$}' already exists.`)
        )
      );
    }

    let keyPair: KeyPairWithAlias;
    switch (formData.algorithm.$) {
      case 'ed25519': {
        keyPair = {
          alias: formData.name.$,
          keyPair: Keys.Ed25519.parseKeyPair(
            decodeBase16(formData.publicKey.$.substring(2)),
            decodeBase64(formData.secretKeyBase64.value)
          ),
          backedUp: false
        };
        break;
      }
      case 'secp256k1': {
        keyPair = {
          alias: formData.name.$,
          keyPair: Keys.Secp256K1.parseKeyPair(
            decodeBase16(formData.publicKey.$.substring(2)),
            decodeBase64(formData.secretKeyBase64.value),
            'raw'
          ),
          backedUp: false
        };
        break;
      }
      default: {
        throw new Error('Invalid algorithm selected');
      }
    }

    if (this.state.keyDownloadEnabled) {
      await this.props.authContainer.downloadPemFiles(keyPair.alias);
    }

    await this._onSubmit(method.Created);
  }

  onImportAccount() {
    if (this.accountForm.submitDisabled) {
      return;
    }
    this._onSubmit(method.Imported);
  }

  async _onSubmit(source: method) {
    await this.props.authContainer.importUserAccount(
      this.accountForm.name.$,
      this.accountForm.secretKeyBase64.value,
      this.accountForm.algorithm.$,
      source === method.Created ? false : true
    );
    this.props.history.push(Pages.Home);
    this.props.history.replace(Pages.Home);
  }

  renderImportForm() {
    const form = this.accountForm as ImportAccountFormData;
    return (
      <form className={this.props.classes.root}>
        <Typography id="continuous-slider" variant="h6" gutterBottom>
          Import from Secret Key File
        </Typography>
        <FormControl>
          <Box
            display={'flex'}
            flexDirection={'row'}
            alignItems={'center'}
            m={1}
          >
            <Button
              id={'private-key-uploader'}
              variant="contained"
              style={{
                backgroundColor: 'var(--cspr-dark-blue)',
                color: 'white'
              }}
              component="label"
            >
              Upload
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  form.handleFileSelect(e)
                }
              />
            </Button>
            <Box ml={1}>
              <Typography component={'span'}>
                <Box fontSize={12}>
                  {form.file ? form.file.name : 'No file selected'}
                </Box>
              </Typography>
            </Box>
          </Box>
        </FormControl>
        <TextFieldWithFormState
          fullWidth
          label="Name imported account"
          placeholder="Human Readable Alias"
          id="import-name"
          fieldState={this.accountForm.name}
        />
        <FormControl fullWidth className={this.props.classes.importButton}>
          <Button
            type="submit"
            disabled={this.accountForm.submitDisabled}
            color="primary"
            variant={'contained'}
            onClick={() => {
              this.onImportAccount();
            }}
          >
            Import
          </Button>
        </FormControl>
      </form>
    );
  }

  revealSecretKey = () => {
    if (this.state.revealSecretKey) return;
    confirm(
      <div className="text-danger">Reveal Key</div>,
      <span>Confirm password to reveal key</span>,
      'Reveal',
      'Cancel',
      { requirePassword: true }
    ).then(() => {
      this.setState({ revealSecretKey: true });
      setTimeout(() => this.setState({ revealSecretKey: false }), 5000);
    });
  };

  renderCreateForm() {
    const formData = this.accountForm as CreateAccountFormData;
    return (
      <form
        className={this.props.classes.root}
        onSubmit={e => {
          e.preventDefault();
        }}
      >
        <Typography variant="h6" style={{ marginTop: '-1em' }}>
          Create Account
        </Typography>
        <TextFieldWithFormState
          aria-label="Input for setting name of key"
          autoFocus
          fullWidth
          label="Name"
          placeholder="Human Readable Alias"
          id="import-name"
          fieldState={this.accountForm.name}
        />
        <FormControl fullWidth>
          <InputLabel id="algo-select-lbl">Algorithm</InputLabel>
          <SelectFieldWithFormState
            fullWidth
            labelId="algo-select-lbl"
            fieldState={this.accountForm.algorithm}
            selectItems={[
              { value: 'ed25519', text: 'ED25519' },
              { value: 'secp256k1', text: 'SECP256k1' }
            ]}
          />
        </FormControl>
        <TextFieldWithFormState
          fullWidth
          InputProps={{ readOnly: true, disabled: true }}
          label="Public Key"
          id="create-public-key"
          value={formData.publicKey.$ ? formData.publicKey.$ : ''}
        />
        <FormControl fullWidth margin={'normal'}>
          <Button
            type="submit"
            className="mt-5"
            disabled={this.accountForm.submitDisabled}
            color="primary"
            variant="contained"
            onClick={() => {
              this.onCreateAccount();
            }}
          >
            Create
          </Button>
        </FormControl>
      </form>
    );
  }

  render() {
    return (
      <div>
        <div className="mt-5 mb-4">
          {this.accountForm instanceof CreateAccountFormData
            ? this.renderCreateForm()
            : this.renderImportForm()}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(AccountPage));
